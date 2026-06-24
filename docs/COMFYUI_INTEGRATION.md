# ComfyUI Integration

## 書き込み仕様

ComfyUI側は `actions/action.json` を直接書き換えず、リポジトリ直下の `actions/action.json.tmp` にJSONを書き出してください。
viewer_three_vrm 側は `action.json.tmp` の内容が1回の監視周期で安定したことを確認し、JSONとして正しく、ルートがObjectの場合だけ `actions/action.json` へ置換します。

壊れたJSON、配列などObject以外のJSON、読み取り中のファイルは `action.json` へ反映しません。エラーはviewer_three_vrm のGUIログと標準ログに表示され、最後に成功した `action.json` の表示と動作を維持します。

`speech_audio` はリポジトリルートからの相対パス、または絶対パスを指定できます。viewer_three_vrm では `wav` / `ogg` / `mp3` を対象にします。
`motion_file` はVRM向けモーションファイルの受け渡し用です。標準ルートは `.vrma` を想定し、`assets/motions_vrma/walk.vrma` を検証パスにします。現行の walk は CMU direct export です。現時点のGodot側にはVRMA再生実装がないため、`.vrma` が指定された場合は存在/不存在ログと未対応ログを出して `motion` にフォールバックします。
`lip_sync_enabled` を `true` にすると、音声再生中にGodette.glbの口BlendShape `ah` / `ih` / `uu` / `ee` / `oh` を簡易リップシンクとして切り替えます。
`lip_sync_debug` を `true` にすると、確認用に口の開きが大きくなります。

## JSON例

```json
{
  "character": "Godette",
  "emotion": "happy",
  "motion": "talk",
  "motion_file": "",
  "speech": "ComfyUIからの発話テストです",
  "speech_audio": "assets/audio/test.wav",
  "lip_sync_enabled": true,
  "lip_sync_debug": false,
  "camera": "front",
  "source": "comfyui"
}
```

`motion` は現在 `idle` / `talk` / `happy` / `thinking` / `wave` / `walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` / `bow` / `dance` に対応しています。未対応の値はviewer_three_vrm 側で `idle` として扱います。`walk` / `run` / `natural_walk` / `natural_idle` / `natural_wave` と外部FBX/GLB由来のretargetは experimental です。標準ルートは `motion_file` の `.vrma` へ移行します。

## Pythonから書き込む例

```bash
cd /home/k/Desktop/ai_avatar_runtime
python3 tools/write_action.py \
  --character Godette \
  --emotion happy \
  --motion talk \
  --motion-file "" \
  --speech "ComfyUIからの発話テストです" \
  --speech-audio assets/audio/test.wav \
  --lip-sync-enabled \
  --lip-sync-debug \
  --camera front \
  --source comfyui
```

このスクリプトは `actions/` 内に一時ファイルを書いてから `actions/action.json.tmp` へ置換します。viewer_three_vrm 起動中であれば、次の監視タイミングで検証され、成功時だけ `action.json` に反映されます。
