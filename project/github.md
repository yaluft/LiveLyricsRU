repo: yaluft/LiveLyricsRU
branch: main
path: client/

## Last sync
date: 2026-07-31T21:25:00Z

### Updated in this project
- Recreated the current single-dock UI (now playing, search dropdown, related panel) from `client/index.html` + `client/src/style.css`.
- Started a v2 redesign: ocean-wave background, split chrome, artist widget, queue/library, vocabulary, clip sharing.

## Screen map
| Project screen | Repo files |
|---|---|
| Current UI 1a — now playing / settings | client/index.html, client/src/style.css, client/src/lyrics.ts, client/src/player.ts, client/src/bg.ts |
| Current UI 1a — search / related | client/index.html, client/src/style.css, client/src/search.ts, client/src/main.ts |
| Лирика v2 (all screens) | same as above (palette from bg.ts THEMES.Ocean; API surface from README.md, client/src/api.ts) |
