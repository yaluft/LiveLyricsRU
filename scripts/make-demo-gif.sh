#!/usr/bin/env bash
# Converts the video recorded by e2e/record-demo.spec.ts into docs/demo.gif.
#
# Usage:
#   npx playwright test e2e/record-demo.spec.ts
#   ./scripts/make-demo-gif.sh
set -euo pipefail

cd "$(dirname "$0")/.."

VIDEO=$(find test-results -name '*.webm' -path '*record-demo*' | head -n1)
if [ -z "$VIDEO" ]; then
  echo "No recording found. Run: npx playwright test e2e/record-demo.spec.ts" >&2
  exit 1
fi

OUT="docs/demo.gif"
PALETTE=$(mktemp --suffix=.png)
trap 'rm -f "$PALETTE"' EXIT

WIDTH=900
FPS=14

ffmpeg -y -i "$VIDEO" -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen=stats_mode=diff" "$PALETTE"
ffmpeg -y -i "$VIDEO" -i "$PALETTE" -filter_complex \
  "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
  "$OUT"

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
