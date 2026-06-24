# AI Avatar Runtime

`viewer_three_vrm` を正式なメインアプリとして運用します。3Dアバター表示、VRMAモーション再生、`actions/action.json` の確認は、まずこちらを使います。

## 起動

```bash
./tools/start_viewer.sh
```

起動後は `http://127.0.0.1:5173/` を開きます。

## モーション方針

- 既存モーションは VRMA を使用します
- 足りないモーションは Unity batch export で VRMA を作成します
- `actions/action.json` は viewer_three_vrm が監視します

## legacy

旧Godotアプリは削除せず `legacy` として残しています。現時点では非推奨で、通常運用では起動しません。

旧手順が必要な場合のみ、各 legacy 文書を参照してください。
