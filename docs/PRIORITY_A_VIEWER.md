# Priority A: viewer_three_vrm

`viewer_three_vrm` を正式メインとして、次の4領域を優先実装した記録です。

## 1. モーション管理

- VRMA モーションを基本にする。
- カテゴリは `idle / locomotion / gesture / talk / emotion`。
- モーションごとに表示名、カテゴリ、ファイルパスを持たせた。
- お気に入りは localStorage に保存する。
- ループ ON/OFF を切り替えられる。
- 選択だけでは再生せず、再生ボタンで再生する。

## 2. ComfyUI / action.json 連動

- `motion`
- `motion_file`
- `camera`
- `stage`
- `emotion`
- `speech`
- `source`

を反映する。

右パネルに表示するもの:

- `speech`
- `emotion`
- `source`
- `last update`
- `action polling` 状態
- 受信ログ

## 3. モデル管理

- デフォルトモデルとファイル選択モデルを分けて扱う。
- モデル名を表示する。
- モデルごとの補正値を保存する。
  - `ground offset`
  - `scale`
  - `y position`
- 接地補正 ON/OFF を切り替えられる。
- 表情対応状況は `blendshape あり/なし` として表示する。

## 4. カメラ / ステージ管理

- カメラプリセット:
  - `front_full`
  - `front_upper`
  - `side_full`
  - `foot_check`
  - `diagonal`
- ステージプリセット:
  - `default`
  - `dark`
  - `studio`
  - `grid_only`
- 背景色、ライト強度、グリッド、床を UI から調整できる。
- 設定は localStorage に保存する。

## 検証

- `viewer_three_vrm` で `npm run build` を通した。
- 旧 Godot アプリは変更していない。
- 右足補正の定数・処理は変更していない。

## 起動

```bash
./tools/start_viewer.sh
```

ブラウザで `http://127.0.0.1:5173/` を確認先にする。
