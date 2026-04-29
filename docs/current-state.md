# current-state.md

## フェーズ
基本実装完了、動作検証待ち

## 完了済み
- [x] プロジェクト構成設計
- [x] 環境変数定義（NOTION_TOKEN, NOTION_DATABASE_ID, GOOGLE_SERVICE_ACCOUNT_KEY, MANAGEMENT_SPREADSHEET_ID, ACADEMIC_SPREADSHEET_ID）
- [x] GitHub Actions ワークフロー（毎時5分cron + 手動）
- [x] Dependabot 設定
- [x] Notion API クライアント（提出取得・ステータス更新）
- [x] Google Sheets API クライアント
  - [x] 管理シート「設定」読み取り
  - [x] 管理シート「ログ」書き込み
  - [x] 教育運営シート「目安スケジュール」読み取り（任意）
  - [x] 教育運営シート「実装授業とFB（教員記入）」書き込み（任意）
- [x] 提出窓口判定ロジック（教育運営シートがある場合のみ起動）
- [x] バリデーション（学生名・宿題・Plan文字数・Do URL）
- [x] Discord/Teams 通知（受理/却下）
- [x] ログ記録（受理/却下の結果を管理シート「ログ」に追記）
- [x] サプライチェーン攻撃対策（.npmrc, Actions設定, axios不使用確認）
- [x] CLAUDE.md / AGENTS.md / SPEC.md

## 未実装 / 未検証
- [ ] Notion API 実接続テスト
- [ ] Google Sheets API 実接続テスト（設定読み取り→ログ書き込み）
- [ ] Discord Webhook 送信テスト
- [ ] Teams Webhook 送信テスト
- [ ] ACADEMIC_SPREADSHEET_ID が未設定の場合の動作確認
- [ ] 教育運営シート連携テスト（スケジュール判定 + 教員FB転記）
- [ ] エラーハンドリングの網羅的検証

## 既知の課題
- `npm audit` で `uuid` パッケージに moderate 脆弱性あり（googleapis 経由）
- タイムゾーン（JST）の扱いは実環境で要確認
- Discord/Teams Webhook送信のエラーレスポンスハンドリングは最小限
