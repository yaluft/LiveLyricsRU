# Лирика — Immersive Lyrics

A full-stack web app that lets you search or paste a YouTube / VK / Spotify URL, streams the audio through a server-side proxy, fetches time-synced LRC lyrics, and renders a Three.js particle background with word-by-word highlight.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| Python 3 + yt-dlp | `pip3 install --user yt-dlp` |

Verify:
```bash
node --version      # v20.x
python3 -m yt_dlp --version
```

## Install

```bash
cd lyrics-app
npm install
```

## Development

Starts both the Fastify API server (port 3001) and the Vite dev server (port 5173) concurrently:

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

## Production Build

```bash
npm run build
```

Compiles server TypeScript → `server/dist/` and builds Vite frontend → `client/dist/`.

## Run (Production)

```bash
NODE_ENV=production npm start
```

Open **http://localhost:3001**.

## Usage

1. **Search** — type an artist or track name → pick from dropdown
2. **URL** — paste a YouTube, VK, or Spotify URL directly into the search bar and press Enter
3. Lyrics are fetched automatically from [LRCLIB.net](https://lrclib.net) and sync word-by-word with playback
4. Recent tracks appear as thumbnail history below the search bar

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/search?q=Земфира` | YouTube search, returns 8 results |
| GET | `/api/resolve?url=<url>` | Extracts audio stream URL + metadata |
| GET | `/api/stream?url=<url>` | Proxied audio stream (supports Range) |
| GET | `/api/lyrics?artist=&title=` | LRC lyrics from LRCLIB.net |
| GET | `/api/related?artist=&title=` | Related songs from YouTube |
| POST | `/api/translate` `{ lines[] }` | Russian→English via MyMemory |
| POST | `/api/pronounce` `{ words[] }` | Russian→Latin romanisation |

## Deployment

### Docker (recommended)

```bash
cp .env.example .env
docker compose up -d
```

The container includes Node 20 + Python 3 + yt-dlp. App serves on port 3001.

### Bare metal (VPS / cloud VM)

```bash
# 1. Install prerequisites
sudo apt install nodejs npm python3-pip
pip3 install --user yt-dlp

# 2. Build
npm install && npm run build

# 3. Run with PM2
npm install -g pm2
NODE_ENV=production pm2 start server/dist/index.js --name lyrika
pm2 save && pm2 startup

# 4. Nginx reverse proxy
sudo cp nginx.conf /etc/nginx/sites-available/lyrika
sudo ln -s /etc/nginx/sites-available/lyrika /etc/nginx/sites-enabled/
# Edit server_name and SSL cert paths in nginx.conf, then:
sudo nginx -t && sudo systemctl reload nginx
```

### Platforms

| Platform | Notes |
|---|---|
| **Railway** | Connect repo → set `PORT=3001`, `NODE_ENV=production`. Add build command `npm run build`. |
| **Render** | Web Service → Build `npm install && npm run build`, Start `node server/dist/index.js` |
| **Fly.io** | `fly launch` auto-detects Dockerfile |
| **DigitalOcean App Platform** | Use Dockerfile deploy |
| **VPS (any)** | Docker Compose or bare-metal with PM2 + nginx |

> **Note:** yt-dlp requires Python 3.10+ on the host/container. The Dockerfile handles this automatically.

## Platform Notes

- **YouTube** — full audio via yt-dlp
- **VK** — full audio via yt-dlp (supports `vk.com/video` URLs)
- **Spotify** — 30-second preview only (no DRM bypass; no API key needed)
- **Direct `.mp3`/`.ogg` URL** — proxied as-is
