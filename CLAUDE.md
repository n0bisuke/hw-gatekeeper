@AGENTS.md
@docs/current-state.md

## Claude Code 固有ルール
- 日本語でコミュニケーションすること
- ファイル読み込みは必要な範囲だけにすること（offset/limitを活用してトークンを節約）
- 大きなコード探索はAgent（サブエージェント）に任せ、メインコンテキストを節約すること
- 実装前に EnterPlanMode で方針を合わせること（1行修正レベルは除く）
- sudo は使用しないこと

## プロジェクト固有の注意点
- Node.js v20+ を使用。GitHub Actions上では `ubuntu-latest` + `actions/setup-node@v4` で実行。
- Google Sheets API は Service Account 認証を使用。`GOOGLE_SERVICE_ACCOUNT_KEY` は Base64エンコードされたJSONキー。
- Notion APIのrich_textプロパティは2000文字制限がある。長いテキストはページ本文に配置すること。
- Discord/Teams通知はWebhook URLを直接使用。Node.js標準の `https` モジュールで送信し、axios等の外部HTTPライブラリは使用しない（サプライチェーン攻撃対策）。
- `npm ci --ignore-scripts` で依存をインストールし、postinstallスクリプトは無効化する。
- 脆弱性検出時は `npm audit` を実行し、修正方針をユーザーに提示すること。
