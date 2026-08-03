<div align="center">

# Лирика · Lyrika

**Synced Russian lyrics with pronunciation, translation, and an ocean you can tune.**

Tap a word for a definition. Loop a line until it sticks. Save it and it comes back for review.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-3c873a?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SolidJS](https://img.shields.io/badge/SolidJS-1.9-4fd2ff?logo=solid&logoColor=001018)](https://solidjs.com)
[![Fastify](https://img.shields.io/badge/Fastify-5-000?logo=fastify&logoColor=white)](https://fastify.dev)
[![SQLite](https://img.shields.io/badge/SQLite-libSQL-003b57?logo=sqlite&logoColor=white)](https://turso.tech/libsql)
[![License](https://img.shields.io/badge/license-MIT-a8ecff)](#license)

</div>

---

## What this is

Lyrika plays a song and shows its lyrics in time with the music — Cyrillic line, Latin
pronunciation above, English translation underneath. It is built for the awkward middle
ground between *listening* and *studying*: let it play, or stop on a word, hear it, save it,
and loop the line at 0.75× until you can sing it.

This is **v3**, a complete rewrite. See [what changed](#what-changed-in-v3) for why.

## Features

- **Word-level sync — when it is real.** Enhanced LRC (A2) `<mm:ss.xx>` word timestamps are
  parsed and used. When a source only has line timings, the app says so and interpolates for
  display only.
- **Pronunciation row.** A reading-aid romanisation, not GOST: `Где свет никогда не гаснет`
  → `gdye svyet nikogda nye gasnyet`.
- **Tap a word → definition.** Lemma-aware lookup against an offline dictionary.
- **Translation, paid for once.** Lines are translated on demand and cached by line hash, so
  a chorus costs one call ever — across every track that shares it.
- **Spaced repetition.** Saved words become FSRS review cards with a real schedule.
- **Loop a line, or an A–B range.** Enforced on the playback clock, so loops hold at any speed.
- **Search or upload.** Paste a YouTube/VK link, search by name, or drop in your own file with
  an optional `.lrc`. Upload works with no network and no `yt-dlp`.
- **Full-text lyric search** over everything ever fetched, offline.
- **A tunable ocean.** Gerstner waves, crest foam, audio reactivity, and **13 live parameters**
  plus animated themes that drift through a cycle on their own.

## Install and run

Requires **Node ≥ 22**. `yt-dlp` and `ffmpeg` are optional.

```bash
git clone https://github.com/yaluft/LiveLyricsRU.git
cd LiveLyricsRU
npm install
npm run dev
```

| | |
| --- | --- |
| Client | http://localhost:5173 |
| API | http://localhost:8787 |

A fresh clone typechecks and runs with **no pre-build step** — `tsc --build` orders the
project references itself.

### The dictionary

Word definitions come from a separate database built offline:

```bash
npm run build:dictionary -- --out ./.data/dictionary.db
```

> ⚠️ **Licensing.** The source corpora (Wiktionary via kaikki.org, OpenRussian) are
> **CC BY-SA**, which is *not* this repository's MIT licence. The generated database is
> therefore **not committed here** — build it yourself or fetch the release artefact, and keep
> the attribution the builder writes into its `about` table.

Without it the app runs fine; word lookups return a romanisation only, and `/api/health`
reports `dictionary: false`.

## Configuration

Copy `.env.example` to `.env`. Everything has a working default.

The two that change behaviour most:

| Variable | Effect when unset |
| --- | --- |
| `YT_DLP_PATH` | Search and URL resolution unavailable; upload still works |
| `ANTHROPIC_API_KEY` | Translation row is **hidden**, not shown as "unavailable" |

## Architecture

```
packages/core     types, LRC / Enhanced-LRC parsing, romanisation — zero runtime deps
packages/server   Fastify 5 · Drizzle · libSQL · yt-dlp · stream proxy
packages/web      SolidJS · Vite · three.js
tools/build-dictionary   one-shot: open corpus → dictionary.db
```

**The client never sees an upstream URL.** `yt-dlp` returns an IP-bound, CORS-less CDN URL;
everything is proxied through `/api/stream/:trackId`, uploads included, so the browser cannot
tell a local file from a remote stream.

**Playback runs on a `requestAnimationFrame` tick, not media events.** `timeupdate` fires
roughly every 250 ms and slows further at reduced rates — far too coarse to hold a loop point.
This is why A–B loops stay tight at 0.5×.

**The audio level bypasses the framework.** The analyser writes to a module-level mutable
object that the ocean's render loop reads each frame; a 60 Hz signal never touches a signal.

## What is real and what is not

Stated plainly, because a demo that pretends is worse than one that admits.

| Area | Status |
| --- | --- |
| Synced lyrics | **Real** — LRCLIB then NetEase, incl. multi-timestamp lines |
| Word-level timing | **Real only when the source provides it.** `timingKind` records which, and interpolated timings are marked `exact: false` and rendered differently |
| Romanisation | **Real**, computed from the text |
| Stream resolution | **Real** — `yt-dlp`, host-allowlisted, never through a shell |
| Upload + range serving | **Real**, content-addressed by SHA-256 |
| Translation | **Real**, via the Claude API, cached permanently. Absent without an API key |
| Word definitions | **Real lookup** against a dictionary you build; absent → romanisation only |
| Vocabulary + spaced repetition | **Real** — FSRS via `ts-fsrs`, with an append-only review log |
| Lyric full-text search | **Real**, SQLite FTS5, offline |
| Artist profiles, clip feed, AI lyric assistant, listening sessions | **Removed.** They were sample data, seed data, a hardcoded placeholder, and a `Math.random()` room code |

## What changed in v3

v2's headline features did not survive an audit:

- **"Word-level sync" was `offset: (span * wi) / words.length`** — a line's duration divided
  evenly across its words. Because those derived offsets were *stored*, nothing downstream
  could distinguish them from real data. v3 stores only what the source gave.
- **Translations existed for 12 demo tracks.** Both live providers set `translation: ''`, so
  every real song printed *«перевод недоступен»* on every line.
- The dictionary was **~70 hand-written lemmas**; the lyric-source setting was written to
  `localStorage` and **never read**; the queue drag handles were decorative `<span>`s; and the
  study button had **no `onClick` handler**.
- There was **no CI**, 14 unit tests in two files, and zero client tests.

v3 cuts the four simulated features and spends the effort on the three that remain.

## Development

```bash
npm run dev         # client + server, hot reload
npm run build       # all packages
npm run typecheck   # tsc --build across the workspace
npm run lint        # eslint, incl. solid/no-destructure
npm test            # vitest — core, server, web
npm run test:e2e    # playwright, no network or yt-dlp required
```

`eslint-plugin-solid` is the reason this project uses ESLint rather than Biome: destructuring
props in a Solid component severs reactivity **silently**, and it is exactly what idiomatic
React does on line one.

Environments that ship their own Chromium can point Playwright at it with
`PLAYWRIGHT_CHROMIUM_PATH` rather than committing an absolute path.

## Security notes

- `yt-dlp` is **never invoked through a shell** — `execFile` with an argv array, every
  caller-supplied value after `--`, a timeout, an output cap, and a minimal environment.
- **Hosts are allowlisted** before any network or subprocess work. Non-HTTP protocols, IPv4
  and IPv6 literals, embedded credentials (`https://youtube.com@evil.example`), trailing-dot
  hosts and suffix lookalikes (`youtube.com.evil.example`) are all refused, with tests.
- A cached stream URL is dropped on 403/404/410 but **not** on 416 — that means only the
  requested range was bad.

## License

MIT. See [LICENSE](LICENSE).

Lyrika does not host or redistribute music or lyrics. It reads from sources you configure and
plays streams you resolve yourself — respect the terms of those services and the copyright of
the works you look up.
