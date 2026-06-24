# Walk Foot Diagnostics

Input: `assets/motions_vrma/walk.vrma` before replacement. The original source is retained as `assets/motions_vrma/cmu_walk_69_02.vrma`.

## Target Tracks

| Humanoid bone | glTF node | sampler | input accessor | output accessor | frames |
| --- | --- | ---: | ---: | ---: | ---: |
| LeftLowerLeg | LeftLeg (#3) | 4 | 8 | 9 | 344 |
| LeftFoot | LeftFoot (#4) | 5 | 10 | 11 | 344 |
| LeftToes | LeftToeBase (#5) | 6 | 12 | 13 | 344 |
| RightLowerLeg | RightLeg (#9) | 9 | 18 | 19 | 344 |
| RightFoot | RightFoot (#10) | 10 | 20 | 21 | 344 |
| RightToes | RightToeBase (#11) | 11 | 22 | 23 | 344 |

## Left/Right Pair Summary

| Pair | frames | average angle difference deg | max angle difference deg | max frame | max time sec |
| --- | ---: | ---: | ---: | ---: | ---: |
| LowerLeg | 344 | 31.69 | 75.49 | 97 | 0.8083 |
| Foot | 344 | 14.35 | 36.92 | 298 | 2.4833 |
| Toes | 344 | 14.01 | 32.47 | 4 | 0.0333 |

## RightFoot Outliers

Frames below are LeftFoot/RightFoot rotation pairs with angle difference >= 30 degrees.

| frame | time sec | leftFoot quaternion xyzw | leftFoot euler XYZ deg | rightFoot quaternion xyzw | rightFoot euler XYZ deg | left/right angle difference deg |
| ---: | ---: | --- | --- | --- | --- | ---: |
| 152 | 1.2667 | 0.21941, -0.04813, 0.02342, 0.97416 | 25.55, -4.79, 3.84 | -0.02335, 0.05587, 0.00183, 0.99816 | -2.70, 6.40, 0.36 | 30.58 |
| 153 | 1.2750 | 0.23084, -0.06674, 0.02834, 0.97029 | 27.05, -6.69, 4.96 | -0.02542, 0.05535, 0.00186, 0.99814 | -2.94, 6.34, 0.38 | 32.94 |
| 154 | 1.2833 | 0.23555, -0.07919, 0.03110, 0.96813 | 27.74, -7.97, 5.65 | -0.02848, 0.05273, 0.00179, 0.99820 | -3.29, 6.04, 0.38 | 34.29 |
| 155 | 1.2917 | 0.23057, -0.08466, 0.03069, 0.96888 | 27.20, -8.62, 5.72 | -0.03081, 0.05371, 0.00189, 0.99808 | -3.56, 6.15, 0.41 | 34.34 |
| 156 | 1.3000 | 0.21737, -0.09288, 0.02871, 0.97124 | 25.70, -9.67, 5.60 | -0.03262, 0.05649, 0.00210, 0.99787 | -3.77, 6.47, 0.45 | 33.77 |
| 157 | 1.3083 | 0.19816, -0.10272, 0.02547, 0.97444 | 23.50, -10.96, 5.28 | -0.03402, 0.05906, 0.00229, 0.99767 | -3.94, 6.76, 0.50 | 32.76 |
| 158 | 1.3167 | 0.17665, -0.11140, 0.02160, 0.97771 | 20.99, -12.13, 4.79 | -0.03516, 0.06105, 0.00245, 0.99751 | -4.07, 6.99, 0.53 | 31.56 |
| 159 | 1.3250 | 0.16800, -0.09902, 0.01903, 0.98062 | 19.83, -10.83, 4.12 | -0.03633, 0.06205, 0.00255, 0.99741 | -4.21, 7.10, 0.55 | 30.02 |
| 295 | 2.4583 | 0.22929, -0.04815, 0.02532, 0.97184 | 26.72, -4.70, 4.10 | -0.03541, 0.01656, 0.00013, 0.99924 | -4.06, 1.90, 0.08 | 31.62 |
| 296 | 2.4667 | 0.24824, -0.04162, 0.02808, 0.96740 | 28.93, -3.82, 4.31 | -0.03927, 0.01475, 0.00002, 0.99912 | -4.50, 1.69, 0.07 | 34.05 |
| 297 | 2.4750 | 0.26274, -0.03777, 0.03044, 0.96365 | 30.63, -3.26, 4.51 | -0.04223, 0.01324, -0.00009, 0.99902 | -4.84, 1.52, 0.05 | 35.98 |
| 298 | 2.4833 | 0.26753, -0.03883, 0.03167, 0.96224 | 31.21, -3.31, 4.70 | -0.04525, 0.01312, -0.00015, 0.99889 | -5.19, 1.50, 0.05 | 36.92 |
| 299 | 2.4917 | 0.26098, -0.04210, 0.03085, 0.96393 | 30.45, -3.73, 4.68 | -0.04874, 0.01350, -0.00020, 0.99872 | -5.59, 1.55, 0.05 | 36.61 |
| 300 | 2.5000 | 0.24563, -0.04655, 0.02837, 0.96783 | 28.65, -4.37, 4.47 | -0.05114, 0.01478, -0.00019, 0.99858 | -5.86, 1.69, 0.06 | 35.20 |
| 301 | 2.5083 | 0.22535, -0.05366, 0.02536, 0.97247 | 26.29, -5.33, 4.23 | -0.05430, 0.01637, -0.00018, 0.99839 | -6.23, 1.87, 0.08 | 33.42 |
| 302 | 2.5167 | 0.20316, -0.06353, 0.02237, 0.97683 | 23.73, -6.61, 4.01 | -0.05895, 0.01808, -0.00020, 0.99810 | -6.76, 2.07, 0.10 | 31.76 |
| 303 | 2.5250 | 0.18013, -0.07421, 0.01927, 0.98065 | 21.08, -7.97, 3.74 | -0.06401, 0.01846, -0.00030, 0.99778 | -7.34, 2.11, 0.10 | 30.16 |

## Candidate Generation

The generated candidates bake a local correction into only the `RightFoot` rotation track. 
`RightLowerLeg`, `RightToes`, and all left-side tracks are left unchanged.

| Candidate | RightFoot correction |
| --- | --- |
| `walk_fixed_roll_pos.vrma` | post-multiply XYZ roll +10 deg |
| `walk_fixed_roll_neg.vrma` | post-multiply XYZ roll -10 deg |
| `walk_fixed_pitch_pos.vrma` | post-multiply XYZ pitch +10 deg |
| `walk_fixed_pitch_neg.vrma` | post-multiply XYZ pitch -10 deg |

Animation: `CMU 69_02 walk forward`

## Candidate Comparison

`viewer_three_vrm/tools/compare_walk_candidates.mjs` was run after generating the four candidates. The legacy comparison score samples the VRMA on `assets/vrm/AliciaSolid_vrm-0.51.vrm` at `t=0` and `t=0.1`; lower is closer to the model rest pose for `RightLowerLeg` + `RightFoot`.

| Candidate | Score | Result |
| --- | ---: | --- |
| `walk.vrma` pre-fix / `cmu_walk_69_02.vrma` | 42.09 | original baseline retained as source reference |
| `walk_fixed_pitch_pos.vrma` | 42.79 | selected fixed candidate |
| `walk_fixed_roll_pos.vrma` | 54.37 | not selected |
| `walk_fixed_roll_neg.vrma` | 54.62 | not selected |
| `walk_fixed_pitch_neg.vrma` | 61.86 | not selected |

`walk_fixed_pitch_pos.vrma` was copied to `walk_fixed.vrma` and then adopted as `walk.vrma`. The viewer-side right foot fix is disabled; the selected correction is baked into the VRMA.
