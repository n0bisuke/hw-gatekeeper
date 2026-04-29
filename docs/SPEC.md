# GATEKEEPER - 宿題管理自動化システム 仕様書

## 1. システム概要

Notionの宿題データベースを定期的に監視し、提出期限内かつ内容に不備がないものだけを教員用スプレッドシートへ転記する「門番（ゲートキーパー）」システム。
不備や期限外の提出は自動的に却下（ステータス差し戻し）し、Discord/Teamsへ詳細な理由を通知する。

### 解決する課題
- 「期限を過ぎた提出」「内容が不十分な提出」が散見
- 教員が個別に温情対応するとクラス全体の規律が維持できない
- 教員の精神的・時間的コストが肥大

### 目指す姿
「システムが門番として振る舞い、合格基準を満たした提出物だけを教員の元へ届ける」。
教員は「FB管理シート」を開いたとき、そこに「期限内に、かつ完璧な形式で出された宿題」だけが並んでいることを保証する。

## 2. 4つの柱

| # | 機能 | 説明 |
|:---|:---|:---|
| 1 | **時間管理（シャッター機能）** | スプレッドシートで受付開始/締切の曜日・時刻を管理。窓の外の提出は1秒の容赦なく却下 |
| 2 | **品質担保（バリデーション機能）** | 学生名・Plan文字数・Do URLを自動チェック。不備は教員の視界に入る前に差し戻し |
| 3 | **教員の作業スペース保護（デリバリー機能）** | 合格した提出物のみを教員FBシートの該当週に転記。不備・遅延分は物理的に載らない |
| 4 | **即時通知** | 受理/却下の結果をDiscord/Teamsへ通知。学生に理由を伝え、教員にチェック対象を届ける |

## 3. 技術スタック

- **Runtime:** Node.js (v20+)
- **CI/CD:** GitHub Actions (Cron + workflow_dispatch)
- **Database:** Notion API
- **Config / Logging:** Google Sheets API
- **Notification:** Discord Webhook / Microsoft Teams Webhook
- **HTTP:** Node.js標準 `https` / `http` モジュール（axios不使用）

## 4. 操作対象となる2つのスプレッドシート

本システムは、役割の異なる **2つのスプレッドシート（ファイル）** を跨いで動作する。

### ① システム管理スプレッドシート（Management）
**用途:** システムの動作設定および実行結果の記録。
- **環境変数:** `MANAGEMENT_SPREADSHEET_ID`（必須）
- **シート:**

#### 「設定」シート（確定）
各クラスの運用サイクルと通知先を管理。

| カラム名 | 説明 |
|:---|:---|
| ターゲットID | Notionタイトルのプレフィックス (例: PO26) |
| 締切曜日 | 提出を締め切る曜日 (例: 火) |
| 締切時刻 | 提出を締め切る時刻 (例: 23:59) |
| 解除曜日 | 次週の受付を開始する曜日 (例: 木) |
| 解除時刻 | 次週の受付を開始する時刻 (例: 09:00) |
| Discord Webhook | 通知用URL |
| Discord Thread | スレッドURL (任意) |
| Teams Webhook | 通知用URL |
| 備考 | 「本科」の場合のみFBシートへの書き込みを実行 |
| 稼働リミット | この日付を過ぎると該当ターゲットの処理をスキップ (例: 2026/9/30) |

#### 「ログ」シート（確定）
判定結果を1行ずつ追記。

| A | B | C | D | E | F |
|:---|:---|:---|:---|:---|:---|
| タイムスタンプ | ターゲットID | タイトル | 週番号 | 結果(受理/却下) | 理由 |

### ② 教育運営スプレッドシート（Academic）
**用途:** 授業スケジュールの参照および合格データの受領。
- **環境変数:** `ACADEMIC_SPREADSHEET_ID`（任意。未設定でもシステムは動作する）
- **シート:**

#### 「目安スケジュール」シート
- A列: 週番号 (1, 2, 3...)
- C列: 基準日 (Date型)

#### 「実装授業とFB（教員記入）」シート
- 受理（Accept）された宿題のNotion URLを追記する最終目的地
- 備考が「本科」のクラスのみが対象

## 5. 環境変数（GitHub Secrets）

| 変数名 | 必須 | 説明 |
|:---|:---:|:---|
| `NOTION_TOKEN` | ✅ | Notion インテグレーション・トークン |
| `NOTION_DATABASE_ID` | ✅ | 宿題DBのID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✅ | サービスアカウントJSONキー（生のJSON1行） |
| `MANAGEMENT_SPREADSHEET_ID` | ✅ | システム管理スプレッドシートのID |
| `ACADEMIC_SPREADSHEET_ID` | — | 教育運営スプレッドシートのID（任意） |

## 6. 用語定義

| 用語 | 意味 |
|:---|:---|
| スプレッドシート | Google Drive上の1つの「ファイル」全体。固有の Spreadsheet ID を持つ |
| シート/タブ | スプレッドシートファイル内にある個別の「タブ」 |
| ターゲットID | Notionタイトルのプレフィックス（例: PO26）。クラス識別に使用 |

## 7. 処理フロー

```
1. システム管理シートから「設定」を読み込む
2. 教育運営シートから「目安スケジュール」を読み込む（任意）
3. Notionから Status=「提出済(FB待ち)」のページを取得
4. 各提出に対して:
   a. タイトルから週番号を抽出
   b. 提出窓口判定（スケジュールがある場合のみ）
   c. バリデーション（学生名/宿題/Plan/Do）
   d. アクション:
      - 受理: Status更新 → ログ記録 → (本科なら)教員FBシートに転記 → Discord/Teams通知
      - 却下: Status差し戻し → ログ記録 → Discord/Teams通知
```

## 8. GitHub Actions

```yaml
name: Gatekeeper Sync
on:
  schedule:
    - cron: '5 * * * *'
  workflow_dispatch:
permissions: {}
jobs:
  run:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: node index.js
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
          NOTION_DATABASE_ID: ${{ secrets.NOTION_DATABASE_ID }}
          GOOGLE_SERVICE_ACCOUNT_KEY: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_KEY }}
          MANAGEMENT_SPREADSHEET_ID: ${{ secrets.MANAGEMENT_SPREADSHEET_ID }}
          ACADEMIC_SPREADSHEET_ID: ${{ secrets.ACADEMIC_SPREADSHEET_ID }}
```

## 9. ファイル構成

```
po-shukudai-monban/
├── index.js                        # エントリーポイント
├── package.json
├── .env.example
├── .npmrc
├── .gitignore
├── CLAUDE.md
├── AGENTS.md
├── docs/
│   ├── SPEC.md                    # 本仕様書
│   ├── current-state.md
│   └── setup.md
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       └── gatekeeper.yml
└── src/
    ├── config.js
    ├── main.js
    ├── notion-client.js
    ├── sheets-client.js
    ├── scheduler.js
    ├── validator.js
    └── notifier.js
```

## 10. セキュリティ

- サービスアカウントキーは環境変数で管理（ファイル配置方式は使わない）
- 外部HTTP通信はNode.js標準モジュールのみ
- `npm ci --ignore-scripts` でpostinstallスクリプト無効化
- GitHub Actionsは最小権限（`permissions: {}`）
- 脆弱性検出時は `npm audit` を実行し修正方針を提示
