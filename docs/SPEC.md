# GATEKEEPER - 宿題管理自動化システム 仕様書

## 1. システム概要

Notionの宿題データベースを定期的に監視し、提出期限内かつ内容に不備がないものだけを転記先スプレッドシートへ転記する「門番（ゲートキーパー）」システム。
不備や期限外の提出は自動的に却下し、Discord/Teamsへ理由を通知する。

### 解決する課題
- 「期限を過ぎた提出」「内容が不十分な提出」が散見
- 教員が個別に温情対応するとクラス全体の規律が維持できない
- 教員の精神的・時間的コストが肥大

### 目指す姿
「システムが門番として振る舞い、合格基準を満たした提出物だけを教員の元へ届ける」。

## 2. 4つの柱

| # | 機能 | 説明 |
|:---|:---|:---|
| 1 | **時間管理（シャッター機能）** | 設定シートで受付開始/締切の曜日・時刻を管理。窓の外の提出は容赦なく却下 |
| 2 | **品質担保（バリデーション機能）** | 学生名・課題ID・Plan文字数・Do URL到達性を自動チェック。不備は教員の視界に入る前に差し戻し |
| 3 | **教員の作業スペース保護（デリバリー機能）** | 合格した提出物のみを転記先シートに転記。不備・遅延分は物理的に載らない |
| 4 | **即時通知** | 受理/却下の結果をDiscord/Teamsへ通知。教員にリプライで確認を促す |

## 3. 技術スタック

- **Runtime:** Node.js (v20+)
- **CI/CD:** GitHub Actions (Cron + push + workflow_dispatch)
- **Database:** Notion API (READ ONLY, v5 SDK / dataSources.query)
- **Config / Logging / Transfer:** Google Sheets API
- **Notification:** Discord Webhook / Microsoft Teams Webhook
- **HTTP:** Node.js標準 `https` / `http` モジュール（axios不使用）

## 4. スプレッドシート構成

本システムは2つのスプレッドシート（ファイル）を跨いで動作する。

### ① システム管理スプレッドシート（Management）
**用途:** システムの動作設定・実行結果の記録。
**環境変数:** `MANAGEMENT_SPREADSHEET_ID`（必須）

#### 「設定」シート
各クラスの運用サイクル・通知先・転記先を管理。

| カラム | プロパティ名 | 説明 |
|:---|:---|:---|
| A | targetId | ターゲットクラスID (例: PO26) |
| B | targetStudentId | ターゲット学生ID (例: 01)。空欄ならクラス全体を監視 |
| C | deadlineWeekday | 提出を締め切る曜日 (例: 火) |
| D | deadlineTime | 提出を締め切る時刻 (例: 23:59) |
| E | unlockWeekday | 次週の受付を開始する曜日 (例: 木) |
| F | unlockTime | 次週の受付を開始する時刻 (例: 9:00) |
| G | discordWebhook | 通知用Discord Webhook URL |
| H | discordThread | Discord Thread URL (`/channels/`形式可。thread_idを自動抽出) |
| I | teamsWebhook | Teams Webhook URL |
| J | acceptPrefix | 受理時通知の接頭辞 (例: `<@ユーザーID> さんFBよろしくお願いします。`) |
| K | rejectPrefix | 却下時通知の接頭辞 (例: `<@ユーザーID> さん受講生フォローお願いします。`) |
| L | quietHours | 通知をスキップする時間帯 (例: `0:30-9:00`) |
| M | operationLimit | この日付を過ぎると該当ターゲットの処理をスキップ (例: 2026/9/30) |
| N | transferSheetId | 受理データを転記するスプレッドシートのID |
| O | transferTabName | 転記先シートのタブ名 (例: 受理宿題) |
| P1 | (システム) | ヘッダー行に `最終稼働: YYYY/M/D H:mm:ss` を自動書込 |
| P(各行) | (システム) | 各ターゲットの最終処理時刻を自動書込 |

#### 「ログ」シート
判定結果を1行ずつ追記。同一ID+同一理由の重複はスキップ。

| A | B | C | D | E | F | G | H |
|:---|:---|:---|:---|:---|:---|:---|:---|
| ID | 実行日時 | クラスID | 課題名 | 判定 | 判定理由 | Notion URL | シート転記 |

- ID: `学生名_課題ID` 形式
- シート転記: 受理時は「済」(転記成功) または「未実施」(転記失敗・未設定)

### ② 転記先スプレッドシート
**用途:** 受理された宿題の転記先。設定シートの「転記先Sheet ID」「転記先 Tab Name」で指定。

| A | B | C | D | E | F |
|:---|:---|:---|:---|:---|:---|
| ID | 実行日時 | クラスID | 課題カテゴリ | 判定 | Notion URL |

## 5. Notionデータベース

### 検索条件
- `Status` = `提出済(FB待ち)`
- タイトルが設定シートのターゲットクラスIDで始まるもの
- ターゲット学生IDが設定されている場合、学籍番号で追加フィルタ

### 使用プロパティ
| プロパティ名 | タイプ | 用途 |
|:---|:---|:---|
| title | title | 提出タイトル (例: `po26-0101_PO202601_西村和史`) |
| 学生名（確認用） | formula | 学生名テキスト。空または `_` なら未入力扱い |
| 課題ID(外部参照用) | formula | 課題IDテキスト (例: `po26-0101`)。空なら宿題未選択扱い |
| 学籍番号 | rollup | 学籍番号 (例: `01`)。ターゲット学生IDとの照合に使用 |
| カテゴリ(自動化用) | formula | 課題カテゴリ (例: `実装付き企画`, `最終制作企画`)。転記先シートの「課題カテゴリ」列に出力 |
| Plan (背景・意図説明・備考)  | rich_text | Plan本文。150文字以上必要 |
| Do (宿題遂行と提出) 宿題記事をツイートしたTwitter URLなど | url | DoのURL。到達性チェックあり |
| Status | select | `提出済(FB待ち)` で検索 |

## 6. バリデーション

| チェック | 条件 | 却下理由 |
|:---|:---|:---|
| 学生名 | `学生名（確認用）`が空または `_` | 「学生名」が未入力です |
| 宿題 | `課題ID(外部参照用)`が空 | 「宿題」が未入力です |
| Plan | 150文字未満 | 「Plan」が150文字未満です (現在: N文字) |
| Do URL (未入力) | URLが空 | 「Do」のURLが未入力です |
| Do URL (プロフィール) | x.com/twitter.comで `/status/` なし | 「Do」がプロフィールURLです。投稿のURLを入力してください |
| Do URL (到達不能) | URLにアクセスできない (x.comはoEmbed API、その他はGET) | 「Do」のURLにアクセスできません: {URL} |

## 7. 窓口判定（曜日パターン）

設定シートの「解除曜日時刻」〜「締切曜日時刻」のパターンで受付窓口を判定。

- 受付中（受理）: 解除曜日時刻以降 〜 締切曜日時刻以前
- 受付外（却下）: 締切曜日時刻以降 〜 解除曜日時刻以前

日付をまたぐパターン（例: 金9:00〜月23:59）にも対応。
曜日・時刻が未設定のターゲットは時間判定なし（常に受理）。

## 8. 通知

### 通知内容
受理・却下ともに以下を含む:
- 設定シートの通知接頭辞（acceptPrefix / rejectPrefix）がある場合は先頭に挿入
- 学生名 (`学生名（確認用）`より)
- 課題ID (`課題ID(外部参照用)`より)
- Notion URL
- 提出週
- Do URL (入力されている場合)
- 却下時: Plan本文 + 却下理由

### Discord メンション
Discordでメンションを飛ばす場合は `<@ユーザーID>` 形式を使用。`@ユーザー名` はただのテキストになる。

### 非通知時間
- 設定シートの「非通知時間」(例: `0:30-9:00`) の間は通知をスキップ
- ログ記録・転記は通常通り実行
- 日付をまたぐ設定にも対応 (例: `22:00-6:00`)

### 重複抑制
- 同じID (`学生名_課題ID`) + 同じ判定理由のログが既にある場合、通知もログ記録もスキップ

## 9. GitHub Actions

```yaml
name: Gatekeeper Sync
on:
  schedule:
    # JST 6:00〜1:59の間30分おき (JST 2:00〜5:59は実行なし)
    - cron: '5,35 0-16,21-23 * * *'
  workflow_dispatch:
  push:
    branches: ['**']
permissions:
  contents: write  # keep-alive用
```

- アクションはフルコミットSHAでバージョン固定
- Dependabotで依存関係の自動更新監視
- 60日ルール対策: 1日1回 `.last-activity` をコミット (`[skip ci]`)
- `npm audit signatures` でパッケージ署名検証を実行

## 10. 環境変数（GitHub Secrets）

| 変数名 | 必須 | 説明 |
|:---|:---:|:---|
| `NOTION_TOKEN` | ✅ | Notion インテグレーション・トークン |
| `NOTION_DATABASE_ID` | ✅ | 宿題DBのID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✅ | サービスアカウントJSONキー (前後クォート付き可) |
| `MANAGEMENT_SPREADSHEET_ID` | ✅ | システム管理スプレッドシートのID |

## 11. セキュリティ

- サービスアカウントキーは環境変数で管理。前後クォート自動除去
- 外部HTTP通信はNode.js標準モジュールのみ (axios不使用)
- `npm ci --ignore-scripts` でpostinstallスクリプト無効化
- `.npmrc` で `ignore-scripts=true` / `save-exact=true` / `package-lock=true` を設定
- `npm audit signatures` でパッケージ署名検証
- GitHub Actionsは最小権限 (`permissions: contents: write`, `persist-credentials: false`)
- CIログではターゲットID・週番号・タイトル等をマスク表示
- スタックトレース・URL・リクエスト情報をログに出力しない

## 12. ファイル構成

```
po-shukudai-monban/
├── index.js                        # エントリーポイント
├── package.json
├── package-lock.json
├── .env.example
├── .npmrc                          # セキュリティ設定
├── .gitignore
├── CLAUDE.md
├── AGENTS.md
├── README.md
├── docs/
│   ├── SPEC.md                     # 本仕様書
│   ├── current-state.md            # 実装状態サマリ
│   └── setup.md                    # セットアップガイド
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       └── gatekeeper.yml          # GitHub Actions
└── src/
    ├── config.js                   # 定数・設定値
    ├── main.js                     # メイン実行フロー
    ├── notion-client.js            # Notion API (dataSources.query)
    ├── sheets-client.js            # Google Sheets API
    ├── scheduler.js                 # 曜日パターン窓口判定
    ├── validator.js                # バリデーション (URL到達性チェック含む)
    └── notifier.js                 # Discord/Teams通知