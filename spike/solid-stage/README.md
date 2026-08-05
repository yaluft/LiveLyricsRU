# Solid Stage spike

A throwaway feasibility prototype: the Lyrika Stage view (now-playing chrome,
synced lyrics, transport, ocean background) reimplemented in
[SolidJS](https://www.solidjs.com/) + Vite, to inform the framework
discussion in `docs/frontend-framework-comparison.md`.

**This is not intended to merge.** It's a separate, self-contained project —
it does not touch `client/`, its `package.json`, or its `node_modules`.

Out of scope (by design — see the task write-up this branch was built from):
search/landing, vocabulary, queue, settings, clips, mobile shell, Studio
layout, A–B loop, rate/volume controls, and any error-handling polish beyond
"doesn't crash on the demo track."

## What's copied verbatim vs. ported

**Copied byte-for-byte, zero changes** (proving the porting cost is in the
component layer, not this core):

- `src/audio/engine.ts` ← `client/src/audio/engine.ts`
- `src/audio/level.ts` ← `client/src/audio/level.ts`
- `src/bg/ocean.ts` ← `client/src/bg/ocean.ts`

These three keep the real client's relative import path
(`ocean.ts` → `../audio/level`) intact, which is why they live under
`src/audio/` and `src/bg/` here too rather than flattened into `src/` — that
nesting is the only reason they resolve without edits.

**Ported to Solid** (rewritten, not byte-identical, same intent):

- `src/store.ts` — a small Solid `createStore` slice of
  `client/src/state/player.ts` (track/lyrics/position/playing/status only;
  the real store is 374 lines covering queue/loops/recents/AI-retry too).
- `src/Stage.tsx` — trimmed `StageLayout.tsx`.
- `src/LyricStage.tsx` — line highlighting + word-tap only (no loop-line,
  save-word, clip, or translation toggle).
- `src/TransportControls.tsx` — play/pause only; prev/next are visually
  present but inert (queue is out of scope).
- `src/Seekbar.tsx` — no A–B loop markers.
- `src/WordPopover.tsx` — calls the real `/api/define`; no save-to-vocabulary
  (that's server-backed and out of scope) or speech synthesis.
- `src/OceanBackground.tsx` — mounts the copied `ocean.ts` via Solid's
  `onMount`/`onCleanup`, the direct equivalent of the real component's
  `useEffect` + `useRef`. No eco-mode fallback (3D-only for the spike).
- `src/styles.css` — a trimmed, mostly copy-pasted subset of
  `client/src/styles/*.css`: just the classes the Stage view renders
  (tokens, ocean, `.stage`/`.dock`/`.transport`, `.seek`, `.lyricstage`/
  `.lyricline`/`.word`/`.word-pop`, `.btn`). This CSS is framework-agnostic
  in the real app too, so this was close to copy-paste.
- `src/vendor/lyrika-shared.ts` — **not** a copy of anything; it's a small
  hand-written stand-in for the bits of `@lyrika/shared` this spike touches
  (`Track`, `Lyrics`, `WordDefinition`, `WaveTheme`/`WAVE_THEMES`). This spike
  deliberately does not build the monorepo's `shared` workspace as a
  dependency, to stay a fully separate project — see "Design decisions"
  below. `vite.config.ts` and `tsconfig.app.json` alias `@lyrika/shared` to
  this file, which is what lets the copied `engine.ts`/`ocean.ts` import it
  unmodified.

## Running it

You need two servers: the real Fastify API (unmodified, from the repo root)
and this spike's Vite dev server.

**Terminal 1 — the real API**, from the repo root:

```bash
npm install   # once, if not already done — builds @lyrika/shared too
npm run dev -w @lyrika/server
```

This serves `http://localhost:8787`. No `yt-dlp` needs to be installed —
`/api/health` will report `ytDlp: false` and the demo catalogue
(`server/src/data/catalog.ts`) answers `/api/resolve`, `/api/lyrics`, and
`/api/define`, which is exactly what this spike exercises.

**Terminal 2 — this spike**, from `spike/solid-stage/`:

```bash
npm install
npm run dev
```

Open `http://localhost:5174/`. It should immediately start playing
`demo-nebo-v-glazakh` (Земфира — Небо в глазах) on the virtual clock, with
lyrics streaming in and the ocean animating behind it.

### Why a proxy, not widened CORS

`vite.config.ts` proxies `/api` → `http://localhost:8787` (override with
`VITE_API_TARGET`), the same approach `client/vite.config.ts` uses for the
real app. `CORS_ORIGIN` already defaults to `http://localhost:5173`
(`.env.example`), and this spike's dev server runs on a different port
(`5174`, to coexist with a running real client) — proxying sidesteps the
cross-origin question entirely rather than widening `CORS_ORIGIN` to a second
origin for a throwaway prototype.

## Design decisions worth flagging

- **No dependency on `@lyrika/shared`.** A real migration would keep
  depending on the shared workspace package. This spike vendors a tiny
  hand-written subset instead (`src/vendor/lyrika-shared.ts`), specifically
  so it stays a fully separate `npm create vite` project that never touches
  the monorepo's workspace graph. That's a spike-only shortcut, not a
  recommendation for the real port.
- **`engine.ts`/`level.ts`/`ocean.ts` kept their original relative nesting**
  (`src/audio/`, `src/bg/`) instead of sitting flat in `src/`, specifically
  so `ocean.ts`'s `import { audioLevel } from '../audio/level'` resolves
  without any edit. Flattening them would have required changing that one
  import line — a small change, but it would have undercut the "these need
  zero changes" claim this spike exists to test.
- **`<For>`, not `.map()`, for lyric lines/words in `LyricStage.tsx`.** Solid
  has a documented gotcha here too: `array.map()` inside JSX works, but
  doesn't do keyed reconciliation — it recreates every DOM node on each
  reactive update instead of patching the ones that changed, which for a
  60fps-adjacent lyric highlight loop would be the least Solid-idiomatic way
  to write it. This spike uses `<For>` throughout.

## Done-criteria verified

All four were checked in a real browser session (headless Chromium driven
via Playwright, screenshotted for visual confirmation — the sandboxed
environment this was built in has no display, so this is the closest
equivalent to "open it and look").

1. **Loading the spike's dev server autoplays a demo track through the
   copied, unmodified `PlaybackEngine`.** Verified: on load, `status` reaches
   `ready` and the displayed position advances on its own (`0:01 → 0:02 →
   0:04` across successive checks) with no user interaction — this is
   `engine.loadVirtual()` + `engine.play()` firing from `onMount` in
   `Stage.tsx`.
2. **Synced lyric lines render and the active line highlights in time with
   playback.** Verified: the active line (`.lyricline--active`) started on
   "Ночь опускается на город" and, left running, advanced on its own to
   "Хочешь, я спою тебе" — the next line in `NEBO_LINES` — with no
   interaction, confirming the highlight tracks `position` against the real
   line timings returned by `/api/lyrics`.
3. **Tapping one lyric word opens a definition popover that successfully
   calls `/api/define` on the real API.** Verified: clicking a word
   triggered a real network request to `/api/define`, which returned
   `{"word":"Хочешь","lemma":"хотеть","translit":"khochyesh'",
   "partOfSpeech":"verb","gloss":"to want"}` from the live Fastify process,
   and the popover rendered that gloss.
4. **The ocean background canvas mounts and visibly animates, driven by the
   shared `audioLevel` object outside Solid's own reactivity.** Verified two
   ways: a full-page screenshot shows the wave shader rendering (not a blank
   or broken canvas), and three screenshots of just the canvas element taken
   ~1.5s apart hashed to three different values — the frame is changing on
   its own over time. No console errors, no visible tearing between Solid's
   render cycle and the WebGL rAF loop.
