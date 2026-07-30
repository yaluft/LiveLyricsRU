# ── Build stage ──────────────────────────────────────────
FROM node:20-slim AS builder

# Install yt-dlp build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl ca-certificates build-essential \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests for better layer caching
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
# Use npm ci for reproducible installs
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ca-certificates \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy runtime artifacts from the builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/package.json ./server/

# Install only production dependencies for the server
RUN cd server && npm install --omit=dev --no-audit --no-fund

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
