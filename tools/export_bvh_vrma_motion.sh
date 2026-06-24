#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 SOURCE_BVH OUTPUT_VRMA [CLIP_NAME]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_BVH_INPUT="$1"
OUTPUT_FILE_INPUT="$2"
CLIP_NAME="${3:-}"
SOURCE_BVH="$SOURCE_BVH_INPUT"
OUTPUT_FILE="$OUTPUT_FILE_INPUT"

if [[ "$SOURCE_BVH" != /* ]]; then
  SOURCE_BVH="$ROOT_DIR/$SOURCE_BVH"
fi

if [[ "$OUTPUT_FILE" != /* ]]; then
  OUTPUT_FILE="$ROOT_DIR/$OUTPUT_FILE"
fi

if [ ! -f "$SOURCE_BVH" ]; then
  echo "Source BVH not found: $SOURCE_BVH" >&2
  exit 1
fi

node "$ROOT_DIR/tools/bvh_to_vrma.mjs" "$SOURCE_BVH" "$OUTPUT_FILE" "$CLIP_NAME"
