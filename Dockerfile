# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY tools/build-dictionary/package.json tools/build-dictionary/
RUN npm ci

COPY tsconfig.base.json tsconfig.json ./
COPY packages packages
COPY tools tools

# `tsc --build` orders the project references itself, so core is compiled
# before the server that imports it without a separate step.
RUN npm run build

# Reduce to production dependencies for the runtime stage.
RUN npm ci --omit=dev

# ---- runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    SERVE_CLIENT=true \
    CLIENT_DIR=/app/packages/web/dist \
    DATA_DIR=/app/.data \
    HOST=0.0.0.0 \
    PORT=8787

# python3 and ffmpeg are yt-dlp's runtime needs. All three are optional to the
# app — without them, resolution degrades and upload remains the working path.
RUN apk add --no-cache ca-certificates ffmpeg python3 \
 && wget -qO /usr/local/bin/yt-dlp \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/core/package.json packages/core/package.json
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/package.json packages/server/package.json
# Migrations are read from disk at boot, relative to the compiled migrate.js.
COPY --from=build /app/packages/server/drizzle packages/server/drizzle
COPY --from=build /app/packages/web/dist packages/web/dist

RUN mkdir -p /app/.data && chown -R node:node /app/.data
USER node

EXPOSE 8787
VOLUME ["/app/.data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
