# Motion Sources

`viewer_three_vrm` の walk 系モーションを集めるために確認したソース一覧です。  
ここでは「取得しやすいか」「ライセンスが運用に乗るか」「VRMA 化しやすいか」を分けて記録します。

## Summary

| Source | Walk assets found | Local VRMA used | License / terms | Notes |
| --- | --- | --- | --- | --- |
| Mixamo | Yes, animation library has walk variants | No | Adobe FAQ states characters and animations are royalty-free for personal, commercial, and non-profit projects. Additional Mixamo terms apply. | Download requires Adobe ID. Access is account-gated, so local collection was not staged in this repo. |
| VRM official sample motions | Sample VRMA examples exist | No | UniVRM samples are distributed through the official VRM / UniVRM channels. The sample docs confirm VRMA support, but a canonical walk asset was not confirmed in the local repo. | `SimpleVrma` confirms the format path, but it is not a walk source. |
| ActorCore | Yes, motion store includes walk loops and SLE packs | No | ActorCore content license is perpetual / royalty-free for apps, games, AR/VR projects under standard licensing. Purchase or inventory access is required for many motions. | Useful as a commercial fallback source, but the actual motion files were not collected locally yet. |
| CMU mocap | Yes, multiple walk subjects and trials | Yes | CMU says the database is free for all uses. | This became the first non-RPM source that produced a better walk VRMA in this repo. |

## CMU candidates that were converted

The CMU conversion path used the cgspeed BVH mirror plus direct BVH -> VRMA export in `tools/export_bvh_vrma_motion.sh`.

| Candidate | CMU source | Status | Notes |
| --- | --- | --- | --- |
| `cmu_walk_69_01.vrma` | Subject 69, trial 01, `walk forward` | generated | Used as a comparison candidate. |
| `cmu_walk_69_02.vrma` | Subject 69, trial 02, `walk forward` | generated | Selected as the new default `walk.vrma`. |

## Source notes

- Mixamo documentation: [Adobe Help](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)
- VRM sample docs: [VRM sample install](https://vrm.dev/en/api/sample/sample_install/) and [VRM Animation](https://vrm.dev/en/vrma/)
- ActorCore license: [ActorCore License](https://actorcore.reallusion.com/license)
- CMU mocap database: [CMU Graphics Lab Motion Capture Database](https://mocap.cs.cmu.edu/)

## Local workflow note

For CMU BVH files, use:

```bash
tools/export_bvh_vrma_motion.sh SOURCE_BVH OUTPUT_VRMA [CLIP_NAME]
```

This bypasses Blender/Unity and exports VRMA directly from BVH using the standard CMU bone names.
