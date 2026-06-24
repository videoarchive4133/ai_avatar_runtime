# VRMA Motions

Place VRM Animation files here.

Expected first test file:

```text
assets/motions_vrma/walk.vrma
```

Use this action payload while Godot VRMA playback is still pending:

```json
{
  "character": "Godette",
  "emotion": "neutral",
  "motion": "idle",
  "motion_file": "assets/motions_vrma/walk.vrma",
  "speech": "VRMA walk fallback check",
  "speech_audio": "",
  "lip_sync_enabled": false,
  "lip_sync_debug": false,
  "camera": "front",
  "source": "vrma_walk_check"
}
```

The current Godot runtime only checks whether the `.vrma` exists, logs that status, and falls back to `motion`. Actual VRMA playback is intentionally left for a later implementation.
