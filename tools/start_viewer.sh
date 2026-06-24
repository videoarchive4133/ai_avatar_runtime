#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
viewer_dir="${repo_root}/viewer_three_vrm"

cd "${viewer_dir}"
exec npm run tauri:dev
