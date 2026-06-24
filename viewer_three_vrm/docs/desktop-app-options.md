# デスクトップアプリ化メモ

## 前提

`viewer_three_vrm` はこのリポジトリの正式メインアプリです。Vite + Three.jsのWebアプリとして維持します。
デスクトップ化では、ビルド済みWeb UIをWebViewに載せ、ローカルファイルアクセスと `actions/action.json` 読み取りをネイティブ側に寄せます。
`model_profiles.json` のような静的 JSON は、Tauri 側で配布資産として保持し、ユーザーの上書きは別領域で管理します。

## 候補

### Tauri

- 配布サイズとメモリ使用量を抑えやすい
- OS標準WebViewを使うため、軽い3D確認アプリに向く
- Rust側でローカルファイル読み込み、watcher、簡易APIを安全に実装できる
- Node.js同梱が不要

注意点:

- Rust/Tauri側の実装が必要
- WebView差分の検証が必要

### Electron

- Node.js APIとWeb UIを同じ技術セットで扱いやすい
- 開発者向けツール、プラグイン、ローカルファイル処理をJS中心で作りやすい
- Chromium同梱なので描画差分を抑えやすい

注意点:

- 配布サイズが大きい
- 常駐メモリが増えやすい

## 推奨

現段階では Tauri を第一候補にします。
理由は、このビューアの主用途がVRM/VRMA確認、`action.json` 連動、ローカルファイル読み込みであり、重いNode.js統合を必須にしていないためです。

Tauri で先に解くべき課題:

- `actions/action.json` の監視をネイティブの file watcher に差し替える
- `model_profiles.json` とユーザー上書き JSON を区別して保存する
- ファイル選択をネイティブダイアログに置き換える
- ログとエラー表示を WebView 内で統一する
- VRMA/VRM/ステージ資産のパス解決をネイティブ側で補助する

Electron を選ぶ条件:

- 将来、Node.js製プラグインやローカル変換処理をUIと密結合したい
- Chromium同梱による描画環境固定を優先したい
- チームがRustよりNode.jsに寄っている

## 移行手順案

1. Web版の `npm run build` を安定させる
2. `actions/action.json` polling をTauri/Electron側API経由に差し替えられるよう、Web側は `/action.json` fetch を維持する
3. ネイティブ側で `actions/action.json` の読み取りAPIを実装する
4. ファイル選択をWeb標準 input からネイティブダイアログへ段階的に置き換える
5. VRM/VRMA表示、action反映、ファイル読み込みをWeb版と同じ手順で検証する
6. モデルプロファイルは `model_profiles.json` を配布資産として持ち、ユーザー設定は別の上書き JSON に分離する

## 現在の準備状況

`viewer_three_vrm` には Tauri の開発用骨組みを追加済みです。

- `npm run tauri:dev`
- `npm run tauri:build`
- `src-tauri/`

開発時は既存の Vite dev server を `http://127.0.0.1:5173/` で起動し、その上に Tauri ウィンドウを重ねる構成です。
この段階では Web 版の `/action.json` 方式を維持してよく、ローカルファイル化は次段階で移します。
Tauri の開発用ポートは `http://127.0.0.1:5180/` に分け、Web版の `5173` と競合しないようにします。
Linux では `libdbus-1-dev` などの開発パッケージが必要です。今回の環境では `libdbus-1-dev` が不足しているため、`tauri:dev` はここで止まりました。
Tauri の `src-tauri/icons/` は `src-tauri/app-icon.svg` から生成済みです。bundle は Linux 向けに `deb` へ絞ってあり、`npm run tauri:build` は確認済みです。

## 開発起動

Web版は引き続き次で使えます。

```bash
./tools/start_viewer.sh
```

Tauri 開発起動は次です。

```bash
cd /home/k/Desktop/ai_avatar_runtime/viewer_three_vrm
npm run tauri:dev
```

このコマンドには Rust toolchain と `tauri-cli` が必要です。
