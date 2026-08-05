# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install         # also builds @lyrika/shared via its `prepare` script
npm run dev         # shared (watch) + server (tsx watch) + client (vite), concurrently
npm run build       # strict order: shared → server → client
npm run typecheck   # tsc --noEmit across all three workspaces (aliased as `npm run lint`)
npm test            # node:test via tsx, server workspace only
npm run test:e2e    # Playwright smoke suite (e2e/), against `npm run dev`
npm start           # run the built server (dist/index.js)
```

Client dev server: http://localhost:5173 (proxies `/api` → `VITE_API_TARGET`, default http://localhost:8787). API: http://localhost:8787.

**`@lyrika/shared` must be built before the other workspaces compile.** Both import it as a package (`@lyrika/shared` → `shared/dist`), not by relative path. If the server or client fails with unresolved `@lyrika/shared` types, run `npm run build -w @lyrika/shared`.

### Tests

All tests currently live in **`server/src/services/urlGuard.test.ts`** — despite the filename, it also covers the LRC parser (`lib/lrc.ts`) and transliteration (`lib/transliterate.ts`). The `test` script glob is `src/**/*.test.ts`, which bash expands to exactly one directory level, so a new test file must sit at `server/src/<dir>/<name>.test.ts` to be picked up. Run a single test by name:

```bash
npm run test -w @lyrika/server -- --test-name-pattern "rejects IP literals"
```

Test files are excluded from `server/tsconfig.json`, so `npm run typecheck` does not check them.

There is no linter or formatter beyond `tsc`. All three workspaces run `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` + `verbatimModuleSyntax`; application code contains no `any`.

**Browser E2E** lives at the repo root in `e2e/*.spec.ts` (Playwright, config at `playwright.config.ts`), separate from the workspace unit tests above. `npm run test:e2e` boots the normal `npm run dev` stack (client on :5173 proxying to the API on :8787) and drives real Chromium. It runs without `yt-dlp` on PATH, so every test exercises the demo-catalogue degrade path (`provider: 'demo'`) rather than real stream resolution — that's deliberate, not a gap: it's the one code path guaranteed to run the same in any environment. A `.mcp.json` at the repo root wires up `@playwright/mcp` for interactive, MCP-driven browser use from Claude Code sessions on this repo.

## Architecture

Three npm workspaces: `shared` (types + wave themes), `server` (Fastify 5), `client` (Vite + React 18 + Zustand + three.js).

### Streams are always proxied, never handed to the browser

`yt-dlp` returns a CDN URL that is IP-bound and CORS-less, so the client never receives it. `/api/resolve` returns `stream.url = /api/stream/:trackId`, and `server/src/routes/index.ts` holds the real URL in a 5-minute in-memory `STREAM_CACHE`. Consequences to preserve when editing that route:

- `STREAM_INFLIGHT` coalesces concurrent cold requests so a media element's parallel buffering doesn't spawn duplicate `yt-dlp` runs.
- A 403/404/410 from upstream evicts the cache entry (the URL went stale); a 416 does not (only that range was bad).
- Route params are already decoded by Fastify — decoding `trackId` again corrupts ids containing `%`.
- The cache is per-process, so multi-instance deploys will re-resolve per instance.

### Track identity is `provider:providerId`

Search results come from `yt-dlp`, not the bundled catalogue, so a catalogue lookup miss is the normal case. `/api/resolve` falls back in three tiers: `findTrack(trackId)` → the `track` object the client sent → parsing the id string itself (`trackFromId`). Anything minting track ids must keep that format.

### Everything degrades to the demo catalogue

Without `yt-dlp` on PATH the app still works end to end: search answers from `server/src/data/catalog.ts` with `sampled: true`, `/api/health` reports `ytDlp: false`, and playback runs on a virtual clock. Do not add code paths that hard-fail when the resolver is absent. Lyrics follow the same shape: LRCLIB → NetEase → bundled demo lyrics → 404.

### Playback: one interface, two backends

`client/src/audio/engine.ts` (`PlaybackEngine`) drives either an `<audio>` element or a virtual clock; the UI cannot tell which. A single module-level instance is created in `state/player.ts` and exported as `engine`.

- Position, loops, and end-of-track are enforced on a `requestAnimationFrame` tick — **not** on media events — which is what makes A–B and line loops hold at 0.5×–1.25×.
- `engine.onUpdate` writes into the Zustand store only past a threshold (0.02s position / 0.5s duration), so a 60 fps clock doesn't re-render on every frame.

### Audio level bypasses React entirely

`client/src/audio/level.ts` exports a mutable `{ value }` object. The engine writes it each frame; `bg/ocean.ts` reads it inside the three.js render loop. Never route this through state — that is a deliberate 60 fps escape hatch.

### Zustand stores and cross-store calls

Four stores under `client/src/state/`: `player` (track/stream/lyrics/queue/loops), `ui` (view, overlays, toasts), `settings` (persisted to `localStorage` as `lyrika.settings` via `persist`), `library` (saved words/lines/clips, server-backed).

Stores reach each other through `getState()`, never hooks — e.g. `player` calls `useUi.getState().toast(...)` and reads `useSettings.getState().aiEnabled`. Follow that pattern rather than introducing a store-to-store hook dependency.

`App.tsx` picks one of four shells: `MobileShell` (media query) → `Landing` (no track) → `StudioLayout` / `StageLayout` (`settings.layout`).

### Errors carry a user-facing hint

Every API error is `{ error, message, hint? }`. The client wraps non-2xx responses in `ApiFailure` (`client/src/api.ts`) and renders `hint` as the row's fallback action ("try the YouTube route"). **`message` and `hint` are Russian user-facing strings** written by the server; keep new ones in Russian and in the same tone.

UI copy instead goes through `client/src/i18n.ts`, where `STRINGS` maps a key to a `[ru, en]` tuple and `lang` may be `'ru' | 'en' | 'both'`. Add both halves for any new key; use the `useT()` hook.

### Security boundary: pasted URLs and the subprocess

This is the sensitive surface and it is the only unit-tested code:

- `services/urlGuard.ts` allowlists hosts (YouTube/VK/Spotify) and rejects non-HTTP protocols, IP literals (v4 and bracketed v6), embedded credentials, and suffix-lookalike hosts (`youtube.com.evil.example`) **before** any network or subprocess work.
- `services/ytdlp.ts` spawns via `execFile` with an argv array — never a shell — with caller values after `--`, a timeout, an 8 MB output cap, and a minimal env (`PATH`/`HOME` only).

Changes here need matching tests. Don't introduce shell interpolation or widen the allowlist without the guard checks.

### Persistence

`lib/store.ts` (`JsonStore`) writes JSON to `DATA_DIR` (default `server/.data`) via temp-file + rename, serialising concurrent writers through a promise chain. It caches in memory and is per-process — fine for one deployment, not for horizontal scaling.

## Configuration

All env vars have working defaults; see `.env.example`. Notable: `SERVE_CLIENT=true` makes the API serve `CLIENT_DIR` with an SPA fallback (`/api/*` still 404s as JSON), which is how the single-container Docker build runs. `docker compose up` serves through nginx on :8080.

## Sample vs real data

`README.md` has a table stating this precisely; keep it accurate when changing behaviour. Summary: lyrics from LRCLIB/NetEase, stream resolution, romanisation, playback, loops, vocabulary and clips are real. Artist profiles (`estimated: true`), the clip feed's other authors, the AI lyric assistant (`simulated: true`, no transcription model wired up), and listening sessions are sample/local-only. Demo-catalogue lyrics are original placeholder text, not the real lyrics of those songs — do not replace them with published lyrics.
