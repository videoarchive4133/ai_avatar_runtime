#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNITY_HUB_BIN="${UNITY_HUB_BIN:-unityhub}"
UNITY_EDITOR="${UNITY_EDITOR:-/home/k/Unity/Hub/Editor/6000.4.8f1/Editor/Unity}"
BLANK_PROJECT="${BLANK_PROJECT:-/home/k/Desktop/VrmaExportTest}"
SAMPLE_REPO="${SAMPLE_REPO:-/home/k/Desktop/AnimationClipToVrmaSample}"
SOURCE_FBX="${SOURCE_FBX:-$ROOT_DIR/assets/motions_src/natural_walk.fbx}"
SAMPLE_INPUT_DIR="${SAMPLE_INPUT_DIR:-$SAMPLE_REPO/Assets/VRMAInput}"

echo "[1/6] Unity Hub CLI check"
"$UNITY_HUB_BIN" -- --headless help
"$UNITY_HUB_BIN" -- --headless editors --installed
"$UNITY_HUB_BIN" -- --headless editors --releases

echo "[2/6] Unity Editor check"
if [ ! -x "$UNITY_EDITOR" ]; then
  echo "Unity Editor not found or not executable: $UNITY_EDITOR" >&2
  exit 1
fi
echo "Using Unity Editor: $UNITY_EDITOR"

echo "[3/6] Prepare blank Unity project"
if [ ! -d "$BLANK_PROJECT/ProjectSettings" ]; then
  mkdir -p "$BLANK_PROJECT"
  "$UNITY_EDITOR" -batchmode -nographics -createProject "$BLANK_PROJECT" -quit
else
  echo "Blank project already exists: $BLANK_PROJECT"
fi

echo "[4/6] Prepare sample VRMA project"
if [ ! -d "$SAMPLE_REPO/.git" ]; then
  git clone https://github.com/malaybaku/AnimationClipToVrmaSample.git "$SAMPLE_REPO"
else
  echo "Sample repo already exists: $SAMPLE_REPO"
fi

echo "[5/6] Stage source FBX into the Unity project"
if [ ! -f "$SOURCE_FBX" ]; then
  echo "Source FBX not found: $SOURCE_FBX" >&2
  exit 1
fi
mkdir -p "$SAMPLE_INPUT_DIR"
cp -f "$SOURCE_FBX" "$SAMPLE_INPUT_DIR/$(basename "$SOURCE_FBX")"
echo "Copied: $SOURCE_FBX -> $SAMPLE_INPUT_DIR/$(basename "$SOURCE_FBX")"

echo "[6/6] Force Unity import so the project is ready for manual export"
"$UNITY_EDITOR" -batchmode -nographics -projectPath "$SAMPLE_REPO" -quit

cat <<EOF

The workspace is prepared.

What is automated here:
- Unity Hub CLI verification
- Installed editor verification
- Blank Unity project creation
- Sample VRMA project clone
- Source FBX copy into the Unity project
- Batch import of the Unity project

Next step:
- Run tools/export_walk_vrma.sh to generate $ROOT_DIR/assets/motions_vrma/walk.vrma without using the Unity Editor GUI

EOF
