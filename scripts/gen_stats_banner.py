#!/usr/bin/env python3
"""Generates docs/stats-banner.svg from the project's own source data.

Reads the demo catalogue and starter dictionary directly (no build step, no
dependencies) and renders a small stat-tile banner for the README. Re-run
whenever server/src/data/catalog.ts or dictionary.ts changes:

    python3 scripts/gen_stats_banner.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "server/src/data/catalog.ts"
DICTIONARY = ROOT / "server/src/data/dictionary.ts"
ROUTES = ROOT / "server/src/routes/index.ts"
OUT = ROOT / "docs/stats-banner.svg"


def count_demo_songs(text: str) -> int:
    return len(re.findall(r"id:\s*'demo-", text))


def count_dictionary_words(text: str) -> int:
    return len(re.findall(r"\{\s*lemma:\s*'", text))


def count_lyrics_sources(text: str) -> int:
    # Distinct `services/<name>.js` modules imported as a fetchLyrics-style
    # function — the real, live lyrics providers wired into the app.
    return len(set(re.findall(r"from '\.\./services/(\w+)\.js'.*fetchLyrics", text))) or \
        len(set(re.findall(r"import\s*\{\s*fetchLyrics[^}]*\}\s*from\s*'\.\./services/(\w+)\.js'", text)))


def tile(x: int, width: int, value: str, label: str) -> str:
    cx = x + width / 2
    return f"""
    <g>
      <text x="{cx}" y="54" text-anchor="middle" class="value">{value}</text>
      <text x="{cx}" y="76" text-anchor="middle" class="label">{label}</text>
    </g>
    """


def divider(x: int) -> str:
    return f'<line x1="{x}" y1="24" x2="{x}" y2="76" class="divider" />'


def main() -> None:
    catalog_text = CATALOG.read_text(encoding="utf-8")
    dictionary_text = DICTIONARY.read_text(encoding="utf-8")
    routes_text = ROUTES.read_text(encoding="utf-8")

    songs = count_demo_songs(catalog_text)
    words = count_dictionary_words(dictionary_text)
    sources = count_lyrics_sources(routes_text)

    width, height = 720, 100
    tile_width = width / 3
    stats = [
        (str(songs), "demo songs"),
        (str(words), "starter dictionary words"),
        (str(sources), "live lyrics sources"),
    ]

    tiles = "".join(tile(int(i * tile_width), int(tile_width), v, l) for i, (v, l) in enumerate(stats))
    dividers = "".join(divider(int(i * tile_width)) for i in (1, 2))

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Lyrika project stats">
  <style>
    .bg {{ fill: #001322; }}
    .value {{ font: 700 30px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #4fd2ff; }}
    .label {{ font: 400 12px system-ui, -apple-system, "Segoe UI", sans-serif; fill: #8fb9cc; }}
    .divider {{ stroke: rgba(120, 215, 255, 0.18); stroke-width: 1; }}
    .frame {{ fill: none; stroke: rgba(120, 215, 255, 0.18); stroke-width: 1; }}
  </style>
  <rect class="bg" width="{width}" height="{height}" rx="14" />
  <rect class="frame" x="0.5" y="0.5" width="{width - 1}" height="{height - 1}" rx="14" />
  {dividers}
  {tiles}
</svg>
"""

    OUT.write_text(svg, encoding="utf-8")
    print(f"Wrote {OUT} — {songs} demo songs, {words} dictionary words, {sources} lyrics sources")


if __name__ == "__main__":
    main()
