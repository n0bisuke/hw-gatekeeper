# セットアップ手順

## 前提条件
- Node.js v20+
- Google Cloud プロジェクト（Sheets API 有効化済み）
- Notion Integration（データベースアクセス権付与済み）

## 1. Google Cloud サービスアカウント作成

1. Google Cloud Console → IAMと管理 → サービスアカウント
2. 「サービスアカウントを作成」（名前: `po-shukudai-gatekeeper`）
3. キーを作成しJSONをダウンロード

**⚠️ このJSONは秘密情報です。チャット等に貼り付けないでください。**

## 2. サービスアカウントキーの設定

JSONを1行に圧縮して環境変数に設定。

```bash
# 1行に圧縮
cat downloaded-key.json | jq -c . | pbcopy
# jqがない場合
node -e "console.log(JSON.stringify(require('./downloaded-key.json')))" | pbcopy
```

## 3. スプレッドシートの準備

### システム管理スプレッドシート（必須）
- 「設定」シートを作成（カラム: ターゲットID, 締切曜日, 締切時刻, 解除曜日, 解除時刻, Discord Webhook, Discord Thread, Teams Webhook, 備考）
- 「ログ」シートを作成（カラム: タイムスタンプ, ターゲットID, タイトル, 週番号, 結果, 理由）
- サービスアカウントのメールアドレスに**編集者**権限を付与

### 教育運営スプレッドシート（任意、後回し可）
- 「目安スケジュール」シート
- 「実装授業とFB（教員記入）」シート
- サービスアカウントに編集者権限を付与

## 4. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して各値を設定
```

| 変数名 | 必須 | 説明 |
|:---|:---:|:---|
| `NOTION_TOKEN` | ✅ | Notion インテグレーショントークン |
| `NOTION_DATABASE_ID` | ✅ | 宿題DBのID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✅ | サービスアカウントJSON（1行） |
| `MANAGEMENT_SPREADSHEET_ID` | ✅ | システム管理スプレッドシートID |
| `ACADEMIC_SPREADSHEET_ID` | — | 教育運営スプレッドシートID（任意） |

## 5. ローカル実行テスト

```bash
npm ci --ignore-scripts
node --env-file=.env index.js
```

## 6. GitHub Actions での実行

リポジトリの Settings → Secrets and variables → Actions で以下を登録：

| Secret名 | 値の説明 |
|:---|:---|
| `NOTION_TOKEN` | Notion トークン |
| `NOTION_DATABASE_ID` | 宿題DBのID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウントJSON（1行） |
| `MANAGEMENT_SPREADSHEET_ID` | 管理用SSのID |
| `ACADEMIC_SPREADSHEET_ID` | 教育用SSのID（任意） |

## トラブルシューティング

| エラー | 対処 |
|:---|:---|
| `invalid_grant` | サービスアカウントキーが無効・期限切れ |
| `Notion 403` | インテグレーションにDB権限が付与されていない |
| `Sheets 403` | スプレッドシートにサービスアカウントが共有されていない |
| `Unable to parse range` | シート名が異なる（全角半角含め一字一句正確に） |
