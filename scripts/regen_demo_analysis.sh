#!/usr/bin/env bash
# Re-analyze all demo songs with the current pipeline (beat-aligned chord detection).
# Run from the repo root: bash scripts/regen_demo_analysis.sh
set -euo pipefail

SCRIPT="scripts/analyze_song.py"
AUDIO_DIR="public/demos"
OUT_DIR="public/demos/analysis"

declare -A SONGS=(
  ["riptide"]="demo-riptide"
  ["hotel-california"]="demo-hotel-california"
  ["wonderwall"]="demo-wonderwall"
  ["mr-brightside"]="demo-mr-brightside"
  ["creep"]="demo-creep"
  ["let-her-go"]="demo-let-her-go"
  ["knockin-on-heavens-door"]="demo-knockin-on-heavens-door"
  ["photograph"]="demo-photograph"
)

for slug in "${!SONGS[@]}"; do
  song_id="${SONGS[$slug]}"
  audio="$AUDIO_DIR/$slug.mp3"
  out="$OUT_DIR/$slug.json"

  echo "--- $slug ---"
  python "$SCRIPT" \
    --song-id "$song_id" \
    --audio-path "$audio" \
    --detect-chords \
    --stem-mode demucs \
    --output "$out" \
    --source ai
  echo "  wrote $out"
done

echo ""
echo "Done. All demo analysis files updated."
