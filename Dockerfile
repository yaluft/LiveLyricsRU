# ── Build stage ──────────────────────────────────────────
FROM node:20-slim AS builder

# Install yt-dlp dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl ca-certificates \
    && pip install --no-cache-dir yt-dlp --break-system-packages \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install

# Copy source
COPY . .

# Build server + client
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ca-certificates \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean 

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
