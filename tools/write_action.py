#!/usr/bin/env python3
"""Write actions/action.json.tmp for viewer_three_vrm-side validation and replacement."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
ACTIONS_DIR = REPO_ROOT / "actions"
ACTION_TMP_PATH = ACTIONS_DIR / "action.json.tmp"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create actions/action.json.tmp for AI Avatar Runtime."
    )
    parser.add_argument("--payload", type=Path, help="JSON file to write as action payload.")
    parser.add_argument("--character", default="Godette")
    parser.add_argument(
        "--emotion",
        default="neutral",
        choices=["neutral", "happy", "angry", "sad"],
    )
    parser.add_argument(
        "--motion",
        default="idle",
        choices=["idle", "talk", "happy", "thinking", "wave", "walk", "run", "natural_walk", "natural_idle", "natural_wave", "bow", "dance"],
    )
    parser.add_argument("--motion-file", default="", dest="motion_file")
    parser.add_argument("--speech", default="")
    parser.add_argument("--speech-audio", default="", dest="speech_audio")
    parser.add_argument(
        "--lip-sync-enabled",
        action=argparse.BooleanOptionalAction,
        default=True,
        dest="lip_sync_enabled",
    )
    parser.add_argument(
        "--lip-sync-debug",
        action=argparse.BooleanOptionalAction,
        default=False,
        dest="lip_sync_debug",
    )
    parser.add_argument("--camera", default="front")
    parser.add_argument("--source", default="python_writer")
    return parser.parse_args()


def load_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.payload is not None:
        with args.payload.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        if not isinstance(payload, dict):
            raise ValueError("payload JSON root must be an object")
        return payload

    return {
        "character": args.character,
        "emotion": args.emotion,
        "motion": args.motion,
        "motion_file": args.motion_file,
        "speech": args.speech,
        "speech_audio": args.speech_audio,
        "lip_sync_enabled": args.lip_sync_enabled,
        "lip_sync_debug": args.lip_sync_debug,
        "camera": args.camera,
        "source": args.source,
    }


def write_action_tmp(payload: dict[str, Any]) -> Path:
    ACTIONS_DIR.mkdir(parents=True, exist_ok=True)
    staging_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=ACTIONS_DIR,
            prefix=".action.",
            suffix=".json",
            delete=False,
        ) as file:
            staging_path = Path(file.name)
            json.dump(payload, file, ensure_ascii=False, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())

        os.replace(staging_path, ACTION_TMP_PATH)
        return ACTION_TMP_PATH
    except Exception:
        if staging_path is not None:
            try:
                staging_path.unlink(missing_ok=True)
            except OSError:
                pass
        raise


def main() -> int:
    args = parse_args()
    payload = load_payload(args)
    output_path = write_action_tmp(payload)
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
