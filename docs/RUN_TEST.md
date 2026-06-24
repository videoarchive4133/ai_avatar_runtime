# Run and Test

現在のメイン確認先は `viewer_three_vrm` です。旧Godot手順はこの文書の legacy セクションとして扱います。

## 起動

```bash
cd /home/k/Desktop/ai_avatar_runtime
./tools/start_viewer.sh
```

ブラウザで `http://127.0.0.1:5173/` を開きます。

## 動作確認

1. 起動後、左側GUIに `actions/action.json` の値が表示されます。
2. `再読み込み` ボタンで手動再読込できます。
3. `モデル表示` ボタンで `assets/avatar_glb/` の最初の有効なGLBを表示します。
4. `モデル非表示` ボタンで現在のモデルを消します。
5. `actions/action.json` を保存し直すと、約0.25秒間隔の監視で自動反映されます。
6. `actions/action.json` を保存し直すと、約0.25秒間隔の監視で自動反映されます。
7. `emotion` を `happy` / `neutral` / `sad` / `angry` に変えるとGUI色・ライト色・motion強度が変わります。モデルにBlendShape/ShapeKeyがあれば表情にも反映されます。
8. `正面` / `背面` / `左` / `右` ボタンでCamera3Dの位置だけを切り替えます。
9. `motion` を `idle` / `talk` / `happy` / `bow` / `dance` / `wave` / `walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` に変えると、対応する内部motionまたは外部motionルートを試します。FBX/GLB由来の外部motionとGodot内の自前retargetは experimental 扱いです。標準ルートは `motion_file` によるVRM/VRMAベースへ移行します。`walk.vrma` の現行デフォルトは CMU direct export です。
10. `speech_audio` に `assets/audio/test.wav` のようなリポジトリ相対パス、または絶対パスを指定して保存すると、値が変わったタイミングで音声を再生します。
11. `lip_sync_enabled` が `true` の場合、音声再生中に `ah` / `ih` / `uu` / `ee` / `oh` の口BlendShapeを周期的に切り替えます。
12. `lip_sync_debug` が `true` の場合、口の開きが大きくなり、GUIの `lip_sync_mouth` 表示も更新されます。
13. `speech_audio` は `wav` / `ogg` / `mp3` を対象にします。ファイルが存在しない場合や読み込めない形式の場合、アプリは終了せずGUIの `Log` とGodotログにエラーが表示されます。
14. モデル未表示時に `motion` が変わってもアプリは落ちません。
15. JSONを壊した場合もアプリは終了せず、GUIの `load` と `Log` にエラーが表示されます。JSONを直して保存すると復帰します。

## legacy

以下の詳細手順は旧Godotアプリ向けの保守資料です。通常運用では `viewer_three_vrm` を使い、ここは必要時のみ参照してください。

## モーション方針

標準ルートはVRMモデルとVRM向けモーション形式を前提にします。今後は `actions/action.json` の `motion_file` に `.vrma` を指定し、VRMA再生ルートへ渡す設計にします。

現時点のGodot実装にはVRMA再生処理がありません。そのため `motion_file` が `.vrma` の場合は、GUIの `Log` とGodotログに `VRMA playback is not implemented in the Godot runtime yet` を出し、`motion` で指定した内部motionへ安全にフォールバックします。

`assets/motions/<motion>.glb` を使う既存の外部GLB再生と簡易retargetは experimental です。`walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` は残しますが、標準確認や品質調整の主対象にはしません。腕角度などの自前retarget微調整はこれ以上深追いせず、VRMAまたはVRM対応OSSによる生成/再生検証に切り分けます。

## VRMA配置と生成手順

VRMAファイルは次のディレクトリに配置します。

```text
assets/motions_vrma/
```

最初の検証対象は次の名前にします。

```text
assets/motions_vrma/walk.vrma
```

ComfyUI または `tools/write_action.py` からは `motion_file` にこのパスを渡します。現時点のGodot側は `.vrma` の存在だけを確認し、存在する場合は `VRMA motion_file found: assets/motions_vrma/walk.vrma`、存在しない場合は `VRMA motion_file was not found: assets/motions_vrma/walk.vrma` を出します。実再生はまだ未対応なので、どちらの場合も `VRMA playback is not implemented in the Godot runtime yet` を出して `motion` にフォールバックします。

確認用JSON:

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

CLIで書く場合:

```bash
cd /home/k/Desktop/ai_avatar_runtime
python3 tools/write_action.py \
  --motion idle \
  --motion-file assets/motions_vrma/walk.vrma \
  --speech "VRMA walk fallback check" \
  --no-lip-sync-enabled \
  --source vrma_walk_check
```

### Unity + UniVRMでFBXからVRMAを作る

調査時点の推奨ルートは、既存FBXをUnity上でHumanoid向け `AnimationClip` として扱い、それをVRM Animation `.vrma` に変換する方法です。VRM公式ではVRM AnimationはVRM humanoid向けのアニメーション形式で、`.vrma` 拡張子が推奨されています。UniVRMはUnity上の標準実装として `.vrma` の import/export をサポートしています。

1. Unity 2022.3 LTS以降で検証用プロジェクトを作ります。UniVRMのREADMEでは、現行UniVRMはUnity 2022.3 LTS以降を対象にしています。
2. UniVRMを導入します。VRM 1.0向けは `com.vrmc.gltf` と `com.vrmc.vrm` をUPMで入れるか、UniVRM Releaseから `.unitypackage` を導入します。
3. `assets/motions_src/walk.fbx` をUnityへimportします。
4. FBX Import Settingsの `Rig` で `Animation Type` を `Humanoid` にし、Avatarが有効になることを確認して `Apply` します。T-Poseが必要な場合はUnityのHumanoid設定で修正します。
5. FBX内のAnimationClipを使います。必要ならProject上でclipを複製または抽出して、変換対象の `AnimationClip` として扱います。
6. 変換には `AnimationClipToVrmaSample` を使うのが実務上の近道です。このサンプルはHumanoid向けAnimationClipをVRM Animation `.vrma` に変換するUnityプロジェクトです。
7. 簡易変換ならProjectビューでAnimationClipを右クリックし、`VRM/Convert to VRM Animation` を実行します。
8. 再現度を詰める場合は `VRM/VRM Animation Exporter` を開き、`Avatar` にT-Poseの人型prefab、`Animation` に変換したいAnimationClipを指定して `Export` します。
9. 出力したファイルを `walk.vrma` にリネームし、このリポジトリの `assets/motions_vrma/walk.vrma` に配置します。CMU BVH を使う場合は `tools/export_bvh_vrma_motion.sh` で直接生成します。
10. VRMAには変換時の参照アバターのHumanoid骨格情報が入る場合があります。再配布する可能性がある場合は、使用したFBX、AnimationClip、参照アバターのライセンスと出力条件を記録します。

UniVRM公式のVRMA export説明には、Humanoid hierarchy、T-Pose、時間ごとにposeが変わることが入力条件として示されています。公式ページのサンプルコードは `VrmAnimationExporter` でHumanoid boneを登録し、Animationをsampleしながらframeを追加してglb bytesへ出力する流れです。直接FBXからのワンクリック変換は公式ページの主手順ではないため、FBXはUnityのHumanoid `AnimationClip` にしてから `AnimationClipToVrmaSample` または自前Editor拡張で変換する前提にします。

参照:

- VRM Animation: https://vrm.dev/en/vrma/
- UniVRM: https://github.com/vrm-c/UniVRM
- UniVRM VRM-Animation export: https://vrm.dev/en/vrma/univrm-vrma/vrma-export/
- AnimationClipToVrmaSample: https://github.com/malaybaku/AnimationClipToVrmaSample

### three-vrmでVRMA再生を検証する代替案

GodotにVRMA再生を入れる前に、ブラウザ上でVRM + VRMAの再生だけを検証する案です。`@pixiv/three-vrm-animation` には、VRMAを読む `VRMAnimationLoaderPlugin` と、VRM向けのThree.js `AnimationClip` を作る `createVRMAnimationClip` が用意されています。

最小構成:

1. ViteなどでThree.js検証プロジェクトを作ります。
2. `three`, `@pixiv/three-vrm`, `@pixiv/three-vrm-animation` を入れます。
3. `GLTFLoader` にVRM用pluginを登録してVRMを読みます。
4. 別の `GLTFLoader` に `VRMAnimationLoaderPlugin` を登録して `.vrma` を読みます。
5. `createVRMAnimationClip(vrmAnimation, vrm)` で `AnimationClip` を作ります。
6. `new THREE.AnimationMixer(vrm.scene)` でmixerを作り、`mixer.clipAction(clip).play()` で再生します。
7. ComfyUI連動では、Godotと同じ `actions/action.json` か、それをHTTPで公開したJSONを読み、`motion_file` の値をブラウザ側プレイヤーでロードします。

この案はGodot実装とは別の検証環境です。VRMAの品質、FBXからの変換結果、モデル間の再利用性を先に確認し、問題なければGodot側VRMA実装か、three-vrmを再生担当に分離するかを判断します。

参照:

- VRMAnimationLoaderPlugin: https://pixiv.github.io/three-vrm/docs/classes/three-vrm-animation.VRMAnimationLoaderPlugin.html
- createVRMAnimationClip: https://pixiv.github.io/three-vrm/docs/functions/three-vrm-animation.createVRMAnimationClip.html

## モーション確認用JSON

`actions/action.json` の `motion` だけを差し替えて保存すると、次の監視タイミングで即切り替わります。VRMAを使う設計では `motion_file` に `.vrma` を指定し、`motion` は未対応時のfallbackとして残します。

```json
{
  "character": "Godette",
  "emotion": "happy",
  "motion": "dance",
  "motion_file": "",
  "speech": "簡易モーション確認です",
  "speech_audio": "",
  "lip_sync_enabled": true,
  "camera": "front",
  "source": "motion_check"
}
```

標準確認Sequenceと同じ順序:

```json
{ "motion": "idle" }
{ "motion": "talk" }
{ "motion": "wave" }
```

追加の手動確認用:

```json
{ "motion": "happy" }
{ "motion": "bow" }
{ "motion": "dance" }
{ "motion": "run" }
```

`walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` は experimental のため標準確認Sequenceには含めず、必要な場合だけ手動で切り替えて確認します。

VRMA将来ルートの未対応fallback確認:

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

現時点では `.vrma` の存在/不存在ログと `VRMA playback is not implemented in the Godot runtime yet` が出て、`idle` にフォールバックします。

## Manual Idle Pose Check

初期表示と `idle_base_pose` を確認する場合は、残っている `action.json.tmp` を削除してから `actions/action.json` を直接 idle / neutral に戻します。

```bash
cd /home/k/Desktop/ai_avatar_runtime
rm -f actions/action.json.tmp
cat > actions/action.json <<'EOF'
{
  "character": "Godette",
  "emotion": "neutral",
  "motion": "idle",
  "motion_file": "",
  "speech": "idle pose check",
  "speech_audio": "",
  "lip_sync_enabled": false,
  "lip_sync_debug": false,
  "camera": "front",
  "source": "manual_idle_pose_check"
}
EOF
```

この状態でGodotを起動すると `motion` は `idle` なので、起動時に `assets/motions/run.glb` は読み込みません。GodotログまたはGUIの `Log` で起動時の `Motion changed: idle` を確認してから `モデル表示` を押します。モデル表示直後にも現在motionが再適用され、`Motion changed: idle` が出ます。

モデル表示直後と idle motion 時には、左右の `shoulder` / `upper_arm` / `lowerarm` / `hand` について `pose_rotation` と `idle_base` がログに出ます。このログは現状把握用です。自前retargetの腕角度調整を続けるのではなく、標準モーションはVRMA/VRM対応OSS側で検証します。

ヘッドレスでプロジェクト読み込みだけを確認する場合:

```bash
cd /home/k/Desktop/ai_avatar_runtime
godot/Godot_v4.6.2-stable_linux.x86_64 --headless --path app --quit-after 2
```

## 標準確認Sequence

ComfyUI の `AI Avatar Action Sequence` は標準確認用に次の順で action を書き込みます。

```text
idle -> talk -> wave
```

現在の標準確認Sequenceは experimental な外部GLB/retargetを避けるため、`idle -> talk -> wave` です。`walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` を確認する場合は `AI Avatar Action Writer` または `tools/write_action.py` で手動テストしてください。

## Procedural Bone Motion

`モデル表示` で `assets/avatar_glb/Godette.glb` が読み込まれると、GUIの `Log` に `Skeleton3D: ...` と `Bone ...` の一覧が出ます。
その後 `motion` を切り替えると、外部GLBモーションが無い場合は `Procedural bone motion: wave` のように表示され、頭・胸・腕などのbone poseを小さく動かします。

確認ポイント:

```text
idle  -> 胸/頭がゆっくり揺れる
talk  -> 頭と胸が小さく動く
happy -> 両腕が少し上がる
wave  -> 右腕が左右に振れる
bow   -> spine/chest/headが前傾する
dance -> 両腕と上半身が左右に動く
walk  -> assets/motions/walk.glb があれば外部GLB、無ければ idle
run   -> experimental。手動テストのみ。assets/motions/run.glb があれば外部GLB、無ければ idle
natural_walk / natural_idle / natural_wave -> experimental。FBX/GLB由来の外部retarget確認用
```

motion切替時にはproceduralで触ったbone poseを初期化してから次のmotionを適用します。
必要なboneが見つからないモデルでは `fallback internal motion` が表示され、`avatar_mount` だけを動かします。

## Emotion / Expression

`モデル表示` でGLB/VRMを読み込むと、GUIの `Log` に `BlendShape/ShapeKey mesh: ...` と `BlendShape/ShapeKey: ...` の一覧が出ます。
利用できるBlendShape/ShapeKeyがある場合、`emotion` を変えると `Expression BlendShape applied: happy (...)` のように表示されます。

確認用JSON:

```json
{
  "character": "Godette",
  "emotion": "happy",
  "motion": "dance",
  "motion_file": "",
  "speech": "表情確認です",
  "speech_audio": "",
  "lip_sync_enabled": true,
  "camera": "front",
  "source": "emotion_check"
}
```

確認しやすい値:

```json
{ "emotion": "neutral", "motion": "idle" }
{ "emotion": "happy", "motion": "happy" }
{ "emotion": "sad", "motion": "talk" }
{ "emotion": "angry", "motion": "wave" }
```

BlendShape/ShapeKeyが無いモデル、または該当する表情名が見つからない場合は `Expression fallback: ...` が表示されます。
この場合もGUI色・ライト色・motion強度で `happy` / `neutral` / `sad` / `angry` の違いを確認できます。

## Lip Sync

`lip_sync_enabled` を `true` にして、`speech_audio` に実在する音声ファイルを指定すると、音声再生開始時にGUIの `Log` へ `LipSync started` が表示されます。
再生中は `ah` / `ih` / `uu` / `ee` / `oh` の口BlendShapeだけを周期的に切り替え、再生終了時または音声停止時に `LipSync stopped` を表示して口BlendShapeを0へ戻します。

確認用JSON:

```json
{
  "character": "Godette",
  "emotion": "neutral",
  "motion": "talk",
  "motion_file": "",
  "speech": "リップシンク確認です",
  "speech_audio": "assets/audio/test_long.wav",
  "lip_sync_enabled": true,
  "lip_sync_debug": true,
  "camera": "front",
  "source": "lip_sync_check"
}
```

`lip_sync_enabled` を `false` にして保存すると、音声再生中でもリップシンクを停止します。
`lip_sync_debug` を `true` にすると、口形状が大きく動いて見分けやすくなります。`test_long.wav` は確認時間を確保しやすいので、目視確認に向いています。
ヘッドレス実行では既存仕様どおり音声再生しないため、リップシンクも開始しません。

## 外部GLBモーション experimental

`assets/motions/<motion>.glb` が存在する場合、GodotはそのGLB内の最初のAnimationを読み込み、`avatar_mount` に安全に適用できるtransformトラックだけを再生します。Skeleton/Boneトラックの自前retargetもコード上は残っていますが、どちらも experimental です。

このルートは標準ルートではありません。今後の標準確認は `motion_file` の `.vrma` と、Unity + UniVRM または three-vrm などVRM対応OSSによる生成/再生検証へ移します。

例:

```text
assets/motions/dance.glb
```

この状態で `actions/action.json` を次のように保存すると、GUIの `Log` に `Experimental external GLB motion route` と `External motion loaded: assets/motions/dance.glb` が表示されます。

```json
{
  "character": "Godette",
  "emotion": "happy",
  "motion": "dance",
  "motion_file": "",
  "speech": "外部GLBモーション確認です",
  "speech_audio": "",
  "lip_sync_enabled": true,
  "camera": "front",
  "source": "external_motion_check"
}
```

GLBが存在しない、GLB読み込みに失敗した、または安全に使えるtransformアニメーションが無い場合は、GUIの `Log` に `fallback internal motion` が表示され、内部簡易motionへ戻ります。

`walk` の確認（experimental / 手動テストのみ）:

1. `assets/motions_src/walk.fbx` から作成した `assets/motions/walk.glb` を配置します。
2. 次のコマンドで `walk` の action を書き込みます。

```bash
cd /home/k/Desktop/ai_avatar_runtime
python3 tools/write_action.py --motion walk --emotion happy --speech "walk test" --source walk_test
```

`assets/motions/walk.glb` がある場合は、GUIの `Log` に `Experimental external GLB motion route`、`External motion loaded: assets/motions/walk.glb`、または `External retarget motion loaded: assets/motions/walk.glb` が表示されます。
`assets/motions/walk.glb` が無い場合、または読み込めない場合は `fallback internal motion: walk (...); using idle` が表示され、`idle` へフォールバックします。

`run` の確認（experimental / 手動テストのみ）:

`run` はFBX/GLB由来の自前retargetルートのため experimental 扱いです。標準確認Sequenceには含めず、必要な場合だけ手動で確認します。

1. `assets/motions_src/run.fbx` から作成した `assets/motions/run.glb` を配置します。
2. 次のコマンドで `run` の action を書き込みます。

```bash
cd /home/k/Desktop/ai_avatar_runtime
python3 tools/write_action.py --motion run --emotion happy --speech "run test" --source run_test
```

`assets/motions/run.glb` がある場合は、GUIの `Log` に `Experimental external GLB motion route`、`External motion loaded: assets/motions/run.glb`、または `External retarget motion loaded: assets/motions/run.glb` が表示されます。
`assets/motions/run.glb` が無い場合、または読み込めない場合は `fallback internal motion: run (...); using idle` が表示され、`idle` へフォールバックします。

### walk/run.glb調査手順 experimental

`walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` は experimental のため、調査も手動テスト時だけ実施します。ここで腕角度やbone axisの微調整を続けるのではなく、ログはVRMA/VRM対応OSSへの移行判断材料として扱います。

`assets/motions/walk.glb` または `assets/motions/run.glb` が存在するのに `fallback internal motion: <motion> (...); using idle` になる場合は、外部GLB内のAnimation/Boneトラックを確認します。

1. `assets/motions/walk.glb` または `assets/motions/run.glb` を配置します。
2. `actions/action.json` の `motion` を `walk` または `run` にします。
3. `モデル表示` でGodetteを読み込みます。
4. GUIの `Log` またはGodot標準出力で次の行を確認します。

```text
External motion inspect: assets/motions/walk.glb
External AnimationPlayer: ...
External AnimationLibrary: ...
External Animation: ...
External Animation track_count: ...
External track 0: path=... type=...
External bone animation detected: ...
External bone candidates: ...
Godette bone comparison: ...
External/Godette partial bone match: ...
External retarget bone mapped: ...
External retarget motion loaded: assets/motions/walk.glb
External retarget applied bones: ...
External motion requires retargeting: ...
```

`External retarget motion loaded` が出る場合、主要BoneだけをGodetteのSkeleton3Dへ簡易リターゲットして再生しています。これは experimental です。
`External motion requires retargeting` または `fallback internal motion` が出る場合も、このルートを深追いせず、VRMA生成/再生検証に切り替えます。

## 次工程の調査タスク

VRMA標準ルートの検証は、Godot内の自前retargetとは別タスクに分けます。

1. Unity + UniVRM で既存motionからVRMA生成、またはVRMA再生を検証する。
2. three-vrm / @pixiv/three-vrm でVRM + VRMAのブラウザ再生を検証する。
3. ComfyUI から `motion_file` に `.vrma` を渡し、Godot側または外部プレイヤー側で再生する受け渡し仕様を固める。
4. 検証結果をもとに、GodotへVRMA再生を実装するか、Unity/three-vrmを再生担当に分離するかを決める。

ヘッドレスでプロジェクト読み込みだけを確認する場合:

```bash
cd /home/k/Desktop/ai_avatar_runtime
godot/Godot_v4.6.2-stable_linux.x86_64 --headless --path app --quit-after 2
```

## Avatar Model

`assets/avatar_glb/` に `.glb` を置くと、`モデル表示` ボタン押下時にファイル名順で最初の有効な1体を読み込みます。
`assets/avatar_glb/test_avatar.glb` が存在する場合は、ファイル名順より優先して読み込みます。検証用の test avatar が読み込まれた場合はGUIの `Log` に `Loaded test avatar` が表示されます。
1KB未満のGLBはスキップします。
GLBがない、またはGLB読み込みに失敗した場合だけ `assets/vrm/` のVRMを試します。
GLB/VRMの両方が失敗した場合のみCubeを表示します。

## Test Avatar

`assets/avatar_glb/test_avatar.glb` は、Godette固有のrest pose / bone axis問題を切り分けるための一時検証用GLBです。現在は three.js examples の `RobotExpressive.glb` を使用しています。
取得元: `https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive`

test avatar を使う場合:

```bash
cd /home/k/Desktop/ai_avatar_runtime
ls -lh assets/avatar_glb/test_avatar.glb
godot/Godot_v4.6.2-stable_linux.x86_64 --path app
```

起動後に `モデル表示` を押し、GUIの `Log` で `Loaded test avatar` を確認してください。`idle` / `talk` は procedural motion、`walk` は `assets/motions/walk.glb` の外部retarget確認に使えます。

Godetteへ戻す場合は `assets/avatar_glb/test_avatar.glb` を退避または削除します。既存の `assets/avatar_glb/Godette.glb` は残してあります。

## ヘッドレス検証

GUI表示なしでプロジェクトの読み込みを確認する場合:

```bash
cd /home/k/Desktop/ai_avatar_runtime
godot/Godot_v4.6.2-stable_linux.x86_64 --headless --path app --quit-after 2
```
