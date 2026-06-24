# VRM/VRMA 3Dアバター操作

`viewer_three_vrm` はこのリポジトリの正式なメインアプリです。今後の通常運用は Godot ではなくこちらを起動してください。

`@pixiv/three-vrm` と `@pixiv/three-vrm-animation` を使った、ComfyUI / `actions/action.json` 連動対応のWeb版3Dアバター操作アプリです。
Blender風の左右パネル、中央3Dビュー、下部タイムラインを持つ構成にしています。

主な操作領域:

- 左パネル: モデル、モーション、ステージの管理
- 中央: 3Dビュー
- 右パネル: カメラ、stage/action 状態、再生、ログ
- 下部: タイムライン風のモーション操作

標準入力:

- `/assets/avatar_glb/test_avatar.glb`
- `/assets/vrm/AliciaSolid_vrm-0.51.vrm`
- `/assets/motions_vrma/walk.vrma`
- `/assets/motions_vrma/walk_bad_foot.vrma`
- `/model_profiles.json` の既定プロファイル（配置は `public/model_profiles.json`）

## インストール

```bash
cd /home/k/Desktop/ai_avatar_runtime/viewer_three_vrm
npm install
```

## 起動

リポジトリ直下から起動する場合は次を使います。

```bash
./tools/start_viewer.sh
```

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

ブラウザで `http://127.0.0.1:5173/` を開きます。

Tauri 開発起動は次です。

```bash
npm run tauri:dev
```

このコマンドには Rust toolchain と `tauri-cli` が必要です。
Tauri 側は開発時に `http://127.0.0.1:5180/` を使います。Web版の `http://127.0.0.1:5173/` と並行運用できます。
Linux では `libdbus-1-dev` を含む開発パッケージ群が必要です。
Tauri アイコンは `src-tauri/app-icon.svg` から生成済みです。

## 操作

- `標準GLB`: `/assets/avatar_glb/test_avatar.glb` を読み込み、VRM拡張がなければ標準VRMへフォールバックします。
- `標準VRM`: `/assets/vrm/AliciaSolid_vrm-0.51.vrm` を直接読み込みます。
- `モデルファイル`: ブラウザの `input type=file` で `.vrm` / `.glb` を読み込みます。
- `モーション一覧`: `idle / locomotion / gesture / talk / emotion` のカテゴリでVRMAを表示します。選択だけでは再生しません。
- `Motion Browser`: 検索、最近使ったモーション、お気に入り、タグ表示を備えています。
- `お気に入り`: モーションごとに localStorage へ保存します。
- `ループ`: 現在のモーションのループ有無を切り替えます。
- `プレビュー再生`: 選択中のモーションを再生します。
- `モーションファイル`: `.vrma` を読み込みます。読み込み後は停止状態です。
- `ドラッグ&ドロップ`: `.vrm` / `.vrma` / `.glb` / `.gltf` / `.png` / `.jpg` を直接投げ込めます。
- `ステージファイル`: `.glb` / `.gltf` / `.png` / `.jpg` をステージとして読み込みます。
- `face / eye / lip`: `blink` / `smile` / `aa / ih / ou` を blendshape proxy で触れます。
- `再生`: 選択中のモーションを読み込んで再生します。
- `停止`: 現在のbody motionを一時停止します。
- `リセット`: 現在のbody motionを先頭へ戻して停止します。
- `再生速度`: `0.00x` から `3.00x` まで調整します。
- `action自動再生`: `action.json` の `motion_file` 反映時に自動再生するかを切り替えます。初期値はオフです。
- `モデル補正`: `groundOffset / scale / yPosition / cameraHeight / rightFootFix / notes` を編集し、保存・読込・JSON出力できます。
- `接地補正`: モデルごとの ground offset / scale / y position の適用を切り替えます。
- `scene保存 / scene読込`: 現在状態を JSON に保存して復元できます。
- `camera reset`: 現在のカメラプリセットへ戻します。
- `fullscreen`: 全画面に切り替えます。

カメラプリセット:

- `front_full`
- `front_upper`
- `side_full`
- `foot_check`
- `diagonal`

ステージプリセット:

- `default`
- `dark`
- `studio`
- `grid_only`

右パネルでは以下を確認できます。

- `speech`
- `emotion`
- `source`
- `last update`
- `action polling` 状態
- 受信ログ

ステージは背景色、床面、`GridHelper`、`HemisphereLight`、`DirectionalLight`、shadow設定を持ちます。

## action.json 連動

Vite dev server は共有ファイル `../actions/action.json` を `/action.json` として公開します。
ビューアは2秒ごとに polling し、変更があった値を反映します。

対応フィールド:

- `motion`: `idle / walk / wave / talk / happy / thinking` などの名前をVRMAにマップします。
- `motion_file`: 値が変わったらVRMAを読み込みます。自動再生は `action自動再生` がオンの時だけ行います。
- `camera`: カメラプリセットを切り替えます。`front` は `front_full` に対応します。
- `stage`: 背景、床、グリッド、ライト、shadow設定を更新します。`default` / `dark` / `studio` / `grid_only` または object を指定できます。
- `emotion`: 右パネルの表示に反映します。
- `speech`: 右パネルの表示に反映します。
- `speed`: 再生速度に反映します。
- `source`: UIの `最終ソース` とログに表示します。
- 受信時は `読み込み済み / 未再生` と `再生中` の状態を右パネルに明示します。

例:

```json
{
  "motion_file": "assets/motions_vrma/walk.vrma",
  "camera": "foot_check",
  "stage": {
    "background": "#0f172a",
    "grid": true,
    "floor": {
      "enabled": true,
      "color": "#1f2937"
    },
    "directionalLight": {
      "enabled": true,
      "position": [2, 4, 3],
      "intensity": 2.2
    },
    "shadows": {
      "enabled": true
    }
  },
  "speed": 1,
  "source": "comfyui"
}
```

ブラウザコンソールから手動反映する場合:

```js
window.viewerThreeVrm.applyActionConfig({
  motion_file: 'assets/motions_vrma/walk.vrma',
  camera: 'diagonal',
  stage: 'bright',
  speed: 1.25,
  source: 'manual',
});
```

## ローカル保存

以下は `localStorage` に保存されます。

- お気に入りモーション
- モーションのループ設定
- 最近使ったモーション
- 選択中モーション
- 選択中モデル
- モデル補正値
- カメラプリセット
- ステージプリセットとカスタム stage 設定
- `action自動再生`
- 接地補正
- 現在の scene preset

## ビルド

```bash
npm run build
```

## 通常アプリ化の準備

現時点ではWeb版を維持し、デスクトップ化は未パッケージです。
候補は Tauri と Electron です。

- Tauri: 配布サイズと常駐メモリを抑えやすく、Rust側でローカルファイル/API連携を堅く作れます。今回のようなVite + Three.jsビューアには第一候補です。
- Electron: Node.js統合、既存Web資産、デバッグ体験が強く、将来プラグインや複雑なローカル処理をJS中心で増やす場合に向きます。配布サイズは大きくなります。

このリポジトリでは、`viewer_three_vrm` を正式なメイン運用として維持し、`actions/action.json` 連動やファイル入力をWebで安定させます。
デスクトップ化する場合は `npm run build` の出力をTauri/ElectronのWebViewへ載せ、`/action.json` 相当の読み取りをネイティブ側APIに置き換えます。
詳細メモは [docs/desktop-app-options.md](docs/desktop-app-options.md) を参照してください。

Tauri の開発用骨組みはすでに入っています。

- `src-tauri/`
- `npm run tauri:dev`
- `npm run tauri:build`

## 注意

- 標準GLBはまず `test_avatar.glb` を試します。
- VRM拡張がない場合は `AliciaSolid_vrm-0.51.vrm` へフォールバックします。
- VRMAは `VRMAnimationLoaderPlugin` と `createVRMAnimationClip` で適用します。
- モデル補正の既定値は `public/model_profiles.json` に置き、ユーザー調整は localStorage に重ねる設計です。
- `.gltf` ステージで外部 `.bin` やテクスチャが必要な場合、ブラウザの単体ファイル入力では解決できないことがあります。確実に読む場合は `.glb` を使ってください。
- 右足補正系の定数と処理は既存値のままです。
- 旧Godotアプリは legacy 扱いです。通常運用では起動しません。

## legacy

旧Godotアプリは削除していませんが、通常運用では使いません。旧手順は legacy 扱いの文書に残しています。
