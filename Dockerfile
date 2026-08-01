# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/ shared/
COPY server/ server/
COPY client/ client/
RUN npm ci

COPY . .
RUN npm run build

RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# yt-dlp needs python + ffmpeg. Drop this layer and the app still runs — it
# falls back to the demo catalogue and reports the resolver as unavailable.
RUN apk add --no-cache python3 ffmpeg ca-certificates \
  && wget -qO /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/package.json ./

ENV PORT=8787 \
    HOST=0.0.0.0 \
    SERVE_CLIENT=true \
    CLIENT_DIR=/app/client/dist \
    DATA_DIR=/app/.data \
    YT_DLP_PATH=/usr/local/bin/yt-dlp

RUN mkdir -p /app/.data && chown -R node:node /app/.data
USER node

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
