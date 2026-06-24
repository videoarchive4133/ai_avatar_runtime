# Codexへの指示

目的:
`viewer_three_vrm` を正式メインとして、VRM/VRMAモデルを表示し、`actions/action.json` の内容をGUIから確認・反映できる状態を維持する。

優先度Aの実装内容は [docs/PRIORITY_A_VIEWER.md](PRIORITY_A_VIEWER.md) にまとめる。

前提:
- ComfyUIはインストール済み。
- 最初のVRMモデルは `assets/vrm/` に置く既存テストモデルを使う。
- モーションは VRMA を主軸にする。
- 足りないモーションはまず CMU / Mixamo / ActorCore を確認し、必要なら Unity batch export で VRMA を作る。現行の walk は CMU direct export を使う。
- 後で ComfyUI が `action.json` を書き換える想定。
- OSS構成で、将来的に独立ソフト化・パッケージ化できる設計にする。

作ってほしいもの:
1. `viewer_three_vrm` をメインアプリとして維持する。
2. GUIに以下を表示:
   - 現在の character
   - emotion
   - motion
   - speech
   - camera
   - source
   - `action.json` の読み込み状態
3. 「action.json再読み込み」ボタンを追加。
4. 可能なら一定間隔で `actions/action.json` を監視して変更時に自動反映。
5. `assets/vrm/` にVRMファイルがある場合、最初の1体を読み込んで表示。
6. まだVRM読み込みが難しい場合は、代わりに仮の3Dキャラを表示して、GUIとJSON監視を先に完成させる。
7. ログ表示欄を追加。
8. 失敗してもアプリが落ちないようにする。

ComfyUI確認項目:
- ComfyUIまたはPythonから `actions/action.json` を更新したら、viewer_three_vrm GUIに反映されること。
- emotion を happy / angry / sad に変えた時、GUI表示が変わること。
- motion を idle / wave / dance に変えた時、GUI表示が変わること。
- speech の文章変更がGUIに反映されること。

アプリGUI確認項目:
- 起動できる。
- action.json の現在値が表示される。
- 再読み込みボタンで反映される。
- JSONが壊れていてもエラー表示だけで落ちない。
- VRMまたは仮3Dモデルが表示される。
- 将来、motion名に応じてBVH/VRMAを再生できるよう、処理を分離しておく。

実装方針:
- `action.json` 読み込み処理は独立クラス化。
- VRM表示処理、GUI表示処理、モーション切替処理を分離。
- まず安定優先。
- 大きな改造より、小さい単位で動作確認できる実装にする。

legacy:
- 旧Godotアプリは削除しない。
- 必要なら `app_legacy/` へ移す案を検討するが、現時点では docs 上の退避に留める。
