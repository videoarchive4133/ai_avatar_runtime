#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 SOURCE_FBX OUTPUT_VRMA [CLIP_NAME]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAMPLE_REPO="${SAMPLE_REPO:-/home/k/Desktop/AnimationClipToVrmaSample}"
UNITY_EDITOR="${UNITY_EDITOR:-/home/k/Unity/Hub/Editor/6000.4.8f1/Editor/Unity}"
SOURCE_FBX_INPUT="$1"
OUTPUT_FILE_INPUT="$2"
CLIP_NAME="${3:-}"
SOURCE_FBX="$SOURCE_FBX_INPUT"
OUTPUT_FILE="$OUTPUT_FILE_INPUT"

if [[ "$SOURCE_FBX" != /* ]]; then
  SOURCE_FBX="$ROOT_DIR/$SOURCE_FBX"
fi

if [[ "$OUTPUT_FILE" != /* ]]; then
  OUTPUT_FILE="$ROOT_DIR/$OUTPUT_FILE"
fi

SOURCE_BASENAME="$(basename "$SOURCE_FBX")"
SOURCE_ASSET_PATH="Assets/VRMAInput/$SOURCE_BASENAME"

if [ ! -x "$UNITY_EDITOR" ]; then
  echo "Unity Editor not found or not executable: $UNITY_EDITOR" >&2
  exit 1
fi

if [ ! -d "$SAMPLE_REPO/Assets/VRMAInput" ]; then
  echo "Sample project is not prepared: $SAMPLE_REPO" >&2
  exit 1
fi

if [ ! -f "$SOURCE_FBX" ]; then
  echo "Source FBX not found: $SOURCE_FBX" >&2
  exit 1
fi

cp -f "$SOURCE_FBX" "$SAMPLE_REPO/Assets/VRMAInput/$SOURCE_BASENAME"

VRMA_EXPORT_SOURCE_ASSET_PATH="$SOURCE_ASSET_PATH" \
VRMA_EXPORT_OUTPUT_PATH="$OUTPUT_FILE" \
VRMA_EXPORT_CLIP_NAME="$CLIP_NAME" \
"$UNITY_EDITOR" \
  -batchmode \
  -nographics \
  -projectPath "$SAMPLE_REPO" \
  -executeMethod Baxter.VrmaBatchExport.ExportNaturalWalk \
  -quit

if [ ! -f "$OUTPUT_FILE" ]; then
  echo "VRMA export failed, output not found: $OUTPUT_FILE" >&2
  exit 1
fi

ls -lh "$OUTPUT_FILE"
