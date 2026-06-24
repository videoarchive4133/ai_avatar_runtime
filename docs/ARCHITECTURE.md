# Architecture

## ファイル構成

```text
viewer_three_vrm/
  index.html
  src/
    main.js
    style.css
  docs/
    desktop-app-options.md

app/
  project.godot
  scenes/
    main.tscn
  scripts/
    Main.gd
    ProjectPaths.gd
    ActionWatcher.gd
    ActionPanel.gd
    AvatarView.gd
    MotionController.gd
  addons/
    vrm/
    Godot-MToon-Shader/
actions/
  action.json
assets/
  vrm/
docs/
  RUN_TEST.md
  ARCHITECTURE.md
```

## 責務

`viewer_three_vrm/src/main.js` は起動時に3D表示、GUI、JSON監視、VRMA再生、モーション制御を組み立てて接続します。

`viewer_three_vrm` 側の action watcher は `actions/action.json` の読み込み、変更検知、JSONパースを担当します。壊れたJSONやファイル欠落時はエラーを返し、アプリを落としません。

`viewer_three_vrm` の action panel はGUI表示、再読み込みボタン、ログ欄、emotionに応じた色変更を担当します。

`viewer_three_vrm` の avatar view は `assets/vrm/` の最初のVRM読み込みと、失敗時のフォールバック表示を担当します。

`viewer_three_vrm` の motion controller は `motion` 名を `idle` / `talk` / `happy` / `bow` / `dance` / `wave` / `walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` に正規化し、任意の `motion_file` と一緒に `AvatarView` へ渡します。`motion_file` は `.vrma` を主ルートとして扱います。

旧Godotアプリの `app/` は legacy です。既存の `assets/motions/<motion>.glb` 外部GLB再生と簡易retarget処理は、比較用途として残しますが、主運用の対象ではありません。

`ProjectPaths.gd` は legacy な Godot 側で `app/` からリポジトリ直下の `actions/` と `assets/` を参照するためのパス解決を担当します。

## データフロー

```text
actions/action.json
  -> viewer_three_vrm action watcher
  -> UI state
  -> VRMA / motion controller
  -> avatar view
```

ComfyUIやPythonが `actions/action.json` を更新すると、viewer_three_vrm 側の watcher が内容ハッシュの変化を検知して再パースします。成功時はGUIと3D表示に反映し、失敗時は最後の表示値を残したままログにエラーを出します。
