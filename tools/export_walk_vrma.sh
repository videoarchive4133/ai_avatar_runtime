#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FBX="${SOURCE_FBX:-$ROOT_DIR/assets/motions_src/rpm_animation_library/feminine/fbx/locomotion/F_Walk_002.fbx}"
OUTPUT_FILE="${OUTPUT_FILE:-$ROOT_DIR/assets/motions_vrma/walk.vrma}"

"$ROOT_DIR/tools/export_vrma_motion.sh" "$SOURCE_FBX" "$OUTPUT_FILE" "${VRMA_EXPORT_CLIP_NAME:-}"
