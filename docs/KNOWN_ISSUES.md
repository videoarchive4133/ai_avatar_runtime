# 既知の問題

## 右足のねじれ

`viewer_three_vrm` で再確認したところ、問題は viewer 側の初期姿勢ではありませんでした。

観測結果:

- `AliciaSolid_vrm-0.51.vrm` と `AvatarSample_A.vrm` の静止姿勢では、`LeftUpperLeg / LeftLowerLeg / LeftFoot / RightUpperLeg / RightLowerLeg / RightFoot` はいずれもほぼ identity でした。
- `idle.vrma` では左右足の回転は小さく、右足だけが崩れる現象は再現しませんでした。
- `walk.vrma` では、同じモデル上で `RightLowerLeg` と `RightFoot` の回転が初期フレームから大きく、左足より明確に不自然でした。
- 別モデルでも同じ傾向でした。つまり、特定モデルの bind pose 起因ではありません。
- `walk.vrma` の生トラック自体でも `RightLowerLeg.quaternion` / `RightFoot.quaternion` が左側より大きく、viewer の retarget 後に突然発生する値ではありませんでした。

現時点の切り分け:

- モデル側: 主因ではない
- viewer / three-vrm-animation 側: 単独原因ではなさそう
- VRMA / export 元: もっとも疑わしい
- 右足だけか: 右足の崩れが支配的だが、左足も motion に応じて回る
- 左右両方の軸差か: 右足の軸差が大きく、左足は比較的素直

調査対象:

- VRMA export の humanoid mapping
- RPM source animation の向き
- rightFoot / rightToes のローカル回転
- clip 変換後の足首・つま先の向き

観察メモ:

- `src/main.js` には右足補正の実験ログがありますが、既定では強制補正しません。
- `walk_bad_foot.vrma` はデバッグ用の比較対象として残しています。
- `idle.vrma` は比較上の基準として有効でした。

次にやること:

1. Unity batch export 側の出力差を比較する
2. 足首・つま先の回転を source FBX と VRMA で突き合わせる
3. `walk.vrma` の export 元 FBX を再確認する
4. 必要ならモーション生成段階で修正する
