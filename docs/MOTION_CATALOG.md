# Motion Catalog

`viewer_three_vrm` で使う VRMA モーションの一覧です。  
RPM Animation Library 由来のものに加えて、CMU mocap の walk を直接 VRMA 化した候補も含めています。

## Current set

| Category | VRMA | Source | Status | Notes |
| --- | --- | --- | --- | --- |
| idle | `assets/motions_vrma/idle.vrma` | `assets/motions_src/rpm_animation_library/feminine/fbx/idle/F_Standing_Idle_001.fbx` | generated | 基本の待機モーション |
| walk | `assets/motions_vrma/walk.vrma` | `CMU Graphics Lab subject 69 trial 02` | generated | CMU walk forward を採用。右足の初期回転が RPM 候補より大幅に小さい |
| walk_m_001 | `assets/motions_vrma/walk_m_001.vrma` | `assets/motions_src/rpm_animation_library/masculine/fbx/locomotion/M_Walk_001.fbx` | generated | 比較候補 |
| walk_m_002 | `assets/motions_vrma/walk_m_002.vrma` | `assets/motions_src/rpm_animation_library/masculine/fbx/locomotion/M_Walk_002.fbx` | generated | 比較候補 |
| walk_f_001 | `assets/motions_vrma/walk_f_001.vrma` | `assets/motions_src/rpm_animation_library/masculine/fbx/locomotion/F_Walk_002.fbx` | generated | 比較候補 |
| walk_fem_m_001 | `assets/motions_vrma/walk_fem_m_001.vrma` | `assets/motions_src/rpm_animation_library/feminine/fbx/locomotion/M_Walk_001.fbx` | generated | 比較候補 |
| walk_fem_m_002 | `assets/motions_vrma/walk_fem_m_002.vrma` | `assets/motions_src/rpm_animation_library/feminine/fbx/locomotion/F_Walk_002.fbx` | generated | 比較候補 |
| wave | `assets/motions_vrma/wave.vrma` | `assets/motions_src/rpm_animation_library/feminine/fbx/dance/F_Dances_004.fbx` | generated | 手振りに使える近似モーション |
| talk | `assets/motions_vrma/talk.vrma` | `assets/motions_src/rpm_animation_library/feminine/fbx/expression/F_Talking_Variations_001.fbx` | generated | talking 風の動き |
| happy | `assets/motions_vrma/happy.vrma` | `assets/motions_src/rpm_animation_library/masculine/fbx/expression/M_Standing_Expressions_001.fbx` | generated | greeting / happy 系の表情モーション |
| thinking | `assets/motions_vrma/thinking.vrma` | `assets/motions_src/rpm_animation_library/feminine/fbx/expression/M_Standing_Expressions_010.fbx` | generated | idle variation を thinking 用に流用 |
| walk_bad_foot | `assets/motions_vrma/walk_bad_foot.vrma` | existing asset | existing | 既存アセットをそのまま利用 |
| walk_cmu_69_01 | `assets/motions_vrma/cmu_walk_69_01.vrma` | `CMU subject 69 trial 01` | generated | 比較候補 |
| walk_cmu_69_02 | `assets/motions_vrma/cmu_walk_69_02.vrma` | `CMU subject 69 trial 02` | generated | `walk.vrma` の元になった候補 |

## Walk comparison

All candidates below were evaluated on `assets/vrm/AliciaSolid_vrm-0.51.vrm` using the same `viewer_three_vrm` VRMA application path. Lower scores mean the right lower leg and right foot stayed closer to the model's rest pose at `t=0` and `t=0.1`.

| VRMA | Score | Result |
| --- | --- | --- |
| `assets/motions_vrma/walk.vrma` | 42.09 | selected |
| `assets/motions_vrma/cmu_walk_69_01.vrma` | 55.12 | close, but not better |
| `assets/motions_vrma/walk_f_001.vrma` | 356.16 | worse |
| `assets/motions_vrma/walk_bad_foot.vrma` | 371.00 | worse |
| `assets/motions_vrma/walk_m_001.vrma` | 371.00 | worse |
| `assets/motions_vrma/walk_m_002.vrma` | 371.44 | worse |
| `assets/motions_vrma/walk_fem_m_001.vrma` | 390.00 | worse |
| `assets/motions_vrma/walk_fem_m_002.vrma` | 390.17 | worse |

`walk.vrma` was replaced with `CMU subject 69 trial 02` because it reduced the right-leg twist dramatically without adding viewer-side correction.

## Export attempts

| Candidate FBX | Intended category | Result | Reason |
| --- | --- | --- | --- |
| `assets/motions_src/rpm_animation_library/feminine/fbx/expression/F_Talking_Variations_006.fbx` | happy | failed | Unity batch export 側で humanoid AnimationClip を見つけられなかった |
| `assets/motions_src/rpm_animation_library/feminine/fbx/idle/F_Standing_Idle_Variations_001.fbx` | thinking | failed | Unity batch export 側で humanoid AnimationClip を見つけられなかった |
| `assets/motions_src/rpm_animation_library/masculine/fbx/locomotion/F_Walk_003.fbx` | walk | failed | Unity batch export 側で humanoid AnimationClip を見つけられなかった |

## Export command

Use the generic wrapper below when adding more motions:

```bash
tools/export_vrma_motion.sh SOURCE_FBX OUTPUT_VRMA [CLIP_NAME]
tools/export_bvh_vrma_motion.sh SOURCE_BVH OUTPUT_VRMA [CLIP_NAME]
```

Example:

```bash
tools/export_bvh_vrma_motion.sh \
  /tmp/cmu_walk_candidates/69_02.bvh \
  assets/motions_vrma/walk.vrma \
  69_02
```

## Notes

- `viewer_three_vrm` reads these VRMA files directly.
- `motion` in `action.json` maps to the named VRMA set above.
- `motion_file` can point at a `.vrma` path directly and takes precedence when present.
- Motion selection in the UI does not auto-play; playback still requires the Play button.
- The walk candidate comparison script is `viewer_three_vrm/tools/compare_walk_candidates.mjs`.
- CMU BVH exports are now done directly without Blender or Unity batch export.
