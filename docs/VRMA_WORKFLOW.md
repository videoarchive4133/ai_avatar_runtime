# VRMA Workflow

目的は、ComfyUI から `actions/action.json` に次のような値を書き、`viewer_three_vrm` でVRM向けモーションを再生できる状態へ進めることです。

```json
{
  "motion": "idle",
  "motion_file": "assets/motions_vrma/walk.vrma"
}
```

`viewer_three_vrm` は `.vrma` を主ルートとして扱います。足りないモーションはまず CMU / Mixamo / ActorCore を確認し、必要に応じて Unity batch export を使います。現行の `walk.vrma` は CMU subject 69 trial 02 を直変換したものです。

## 1. Unity Hub の導入

1. Unity公式のUnity Hubページを開きます。
   https://unity.com/download
2. OSに合うUnity Hubをインストールします。
3. Unity Hubを起動し、Unity IDでサインインします。
4. `Installs` からUnity Editorを追加します。UniVRMの現行READMEではUnity 2022.3 LTS以降が対象です。検証時点では Unity Hub から `6000.4.8f1` が利用でき、batchmode でのプロジェクト作成と sample project の import まで通りました。

参照:

- https://docs.unity.com/en-us/hub/install-hub
- https://docs.unity.com/en-us/hub/add-editor

## 2. Unity プロジェクト作成

1. Unity Hubの `Projects` を開きます。
2. `New project` を選びます。
3. Templateは `3D (Built-In Render Pipeline)` または通常の3Dテンプレートを選びます。
4. Project名は例として `vrma-convert-workspace` にします。
5. 任意の作業用ディレクトリに作成します。このリポジトリ直下には作らず、Unity用の別ディレクトリに置く方が安全です。

参照:

- https://docs.unity.com/en-us/hub/projects

## 3. UniVRM 導入

UniVRMはVRM/VRMAのUnity向け標準実装です。UniVRM READMEでは `.vrm` と `.vrma` のimport/export対応が明記されています。

導入方法は2通りあります。

### UPMで導入

1. Unityの `Window > Package Manager` を開きます。
2. `+` から `Add package from git URL...` を選びます。
3. UniVRM ReleaseページにあるUPM用URLを確認し、VRM 1.0向けに必要なpackageを追加します。
4. VRM 1.0向けは `com.vrmc.gltf` と `com.vrmc.vrm` が必要です。
5. `AnimationClipToVrmaSample` の sample project には、`com.vrmc.vrmshaders` / `com.vrmc.gltf` / `com.vrmc.univrm` / `com.vrmc.vrm` の Git 参照が既に入っていました。新規プロジェクトで同等構成を作る場合は、この sample project を起点にするのが最短です。

### unitypackageで導入

1. UniVRM Releasesを開きます。
   https://github.com/vrm-c/UniVRM/releases
2. 対象バージョンの `.unitypackage` をダウンロードします。
3. Unityで `Assets > Import Package > Custom Package...` からimportします。

参照:

- https://github.com/vrm-c/UniVRM
- https://vrm.dev/en/vrma/

## 4. AnimationClipToVrmaSample の利用方法

FBXを直接Godotでretargetするのではなく、Unity上でHumanoid `AnimationClip` にしてから `.vrma` へ変換します。実務上は `AnimationClipToVrmaSample` を使うのが近道です。

1. `AnimationClipToVrmaSample` を開きます。
   https://github.com/malaybaku/AnimationClipToVrmaSample
2. 既存Unityプロジェクトに導入する場合は、READMEのInstall手順に従い、packageを追加します。
3. Project全体を使う場合は、repositoryをcloneしてUnity Hubから開きます。
4. 変換方法は2つあります。
5. 簡易変換: ProjectビューでHumanoid `AnimationClip` を右クリックし、`VRM/Convert to VRM Animation` を実行します。
6. legacy fallback: batchmode を使って `-executeMethod Baxter.VrmaBatchExport.ExportNaturalWalk` を実行すると、`assets/motions_src/natural_walk.fbx` から `walk.vrma` を生成できます。現行のデフォルト walk は CMU BVH の direct export です。
7. 旧RPM系の補完が必要な場合のみ、このリポジトリの `tools/prepare_vrma_export.sh` と `tools/export_walk_vrma.sh` を使います。現行の CMU 系は `tools/export_bvh_vrma_motion.sh` を使います。

注意:

- `.vrma` には変換時に参照したアバターのHumanoid骨格情報が入る場合があります。
- 再配布する可能性がある `.vrma` は、参照アバターと元FBXのライセンスを確認し、生成元を記録します。

## 5. Ready Player Me の FBX を Unity に入れる

このリポジトリにはReady Player Me Animation Library由来のFBXが入っています。

まずはこの組み合わせを使います。

```text
Avatar reference:
assets/motions_src/rpm_animation_library/feminine/fbx/Feminine_TPose.fbx

Walk motion:
assets/motions_src/rpm_animation_library/feminine/fbx/locomotion/F_Walk_002.fbx
```

Unityへのimport:

1. Unity Projectの `Assets/ReadyPlayerMeMotions/` フォルダを作ります。
2. `Feminine_TPose.fbx` と `F_Walk_002.fbx` をUnity Projectへコピーします。
3. `Feminine_TPose.fbx` を選択し、Inspectorの `Rig` で `Animation Type` を `Humanoid` にして `Apply` します。
4. `F_Walk_002.fbx` も同じく `Rig > Animation Type` を `Humanoid` にして `Apply` します。
5. `Avatar Definition` は、まず `Create From This Model` で通るか確認します。必要に応じて `Configure...` でT-Poseとbone mappingを確認します。
6. FBXに埋め込まれたAnimationClipが読み取り専用の場合は、Projectビューでclipを複製または抽出し、変換対象の `AnimationClip` として扱います。

Ready Player MeのAnimation Library READMEでは、収録アニメーションはReady Player Me armature向けにretarget済みで、UnityなどFBX対応ソフトで利用できると説明されています。

参照:

- https://github.com/readyplayerme/animation-library
- https://docs.readyplayer.me/ready-player-me/integration-guides/unity/animations/loading-mixamo-animations

## 6. FBX の AnimationClip を VRMA に export

`AnimationClipToVrmaSample` の `VRM Animation Exporter` を使う手順です。

1. Unity上で `Feminine_TPose.fbx` をSceneまたはProject上のprefabとして使える状態にします。
2. `Feminine_TPose` に `Animator` があり、Humanoid Avatarが有効であることを確認します。
3. `F_Walk_002.fbx` から得た `AnimationClip` を確認します。
4. メニューから `VRM > VRM Animation Exporter` を開きます。
5. `Avatar` に `Feminine_TPose` のprefabまたはT-Poseの人型Avatarを指定します。
6. `Animation` に `F_Walk_002` のAnimationClipを指定します。
7. `Export` を押して `.vrma` を出力します。
8. 出力名は `walk.vrma` にします。

UniVRM公式のVRMA export説明では、入力条件としてHumanoid hierarchy、T-Pose、時間ごとにposeが変わることが示されています。ExporterはAnimationをsampleしてframeを追加し、VRM Animation入りのglb bytesを出力する流れです。

参照:

- https://vrm.dev/en/vrma/univrm-vrma/vrma-export/

## 7. walk.vrma を配置

Unityで出力したファイルをこのリポジトリへ配置します。

```text
/home/k/Desktop/ai_avatar_runtime/assets/motions_vrma/walk.vrma
```

配置後に確認します。

```bash
cd /home/k/Desktop/ai_avatar_runtime
ls -lh assets/motions_vrma/walk.vrma
```

`assets/motions_vrma/README.md` もこの配置先のメモとして残しています。

### 自動化スクリプト

このリポジトリには準備用スクリプトがあります。

```bash
cd /home/k/Desktop/ai_avatar_runtime
bash tools/prepare_vrma_export.sh
bash tools/export_walk_vrma.sh
```

`tools/prepare_vrma_export.sh` は RPM 系の legacy fallback 用です。`tools/export_walk_vrma.sh` は legacy Unity export を呼びます。現在の walk の標準経路は `tools/export_bvh_vrma_motion.sh` です。

## 8. viewer_three_vrm で motion_file を反映する手順

ここでは `motion_file` を指定して viewer_three_vrm 側で反映する手順を確認します。

1. `actions/action.json` に `motion_file` を指定します。

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

2. CLIで書く場合は次を使います。

```bash
cd /home/k/Desktop/ai_avatar_runtime
python3 tools/write_action.py \
  --motion idle \
  --motion-file assets/motions_vrma/walk.vrma \
  --speech "VRMA walk fallback check" \
  --no-lip-sync-enabled \
  --source vrma_walk_check
```

3. viewer_three_vrm を起動してログを確認します。

```bash
cd /home/k/Desktop/ai_avatar_runtime
./tools/start_viewer.sh
```

期待確認:

viewer_three_vrm の UI とログ欄で、`motion_file` が変わったことと `action.json` の更新が反映されたことを確認します。

## legacy

旧Godot runtime の存在確認・fallback 手順は legacy 扱いです。今後は通常運用の確認手順として使いません。
