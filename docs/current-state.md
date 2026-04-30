# 現在の実装状態

> 最終更新: 2026-04-30

## プロジェクト概要
Notionの宿題データベースを定期的に監視し、提出期限内かつ内容に不備がないものだけを転記先シートへ転記する「門番（ゲートキーパー）」システム。
不備や期限外の提出は自動的に却下し、Discord/Teamsへ理由を通知する。

## 現在のバージョン
- Version: 1.0.0 (動作検証中)
- Node.js v20+
- GitHub Actions で 30分おきに自動実行 (JST 2:00〜5:59は除外)

## 実装済み機能

### コアモジュール
| モジュール | 説明 | 状態 |
|---|---|---|
| `src/notion-client` | Notion API (READ ONLY, ターゲットID絞り込み検索, 各種プロパティ取得) | 実装済み |
| `src/sheets-client` | Google Sheets API (設定読み取り, ログ書き込み, 転記先書き込み, 重複チェック) | 実装済み |
| `src/scheduler` | 提出窓口判定 (UnlockDateTime〜DeadlineDateTimeの範囲チェック) | 実装済み (後回し) |
| `src/validator` | バリデーション (学生名・宿題の式フィールド, Plan文字数, Do URL到達性・プロフィールURL検出) | 実装済み |
| `src/notifier` | Discord/Teams Webhook通知 (スレッドURL対応, 標準httpsモジュール) | 実装済み |
| `src/main` | メイン実行フロー (設定読込→Notion取得→バリデーション→重複チェック→ログ/転記/通知) | 実装済み |

### バリデーション
| チェック項目 | 説明 |
|---|---|
| 学生名 | `学生名（確認用）` 式フィールドが空または `_` でないこと |
| 宿題 | `課題ID(外部参照用)` 式フィールドが空でないこと |
| Plan | `Plan (背景・意図説明・備考) ` rich_text が150文字以上であること |
| Do URL | `Do (宿題遂行と提出) 宿題記事をツイートしたTwitter URLなど` が入力済みで到達可能であること |
| Do URL (x.com) | x.com/twitter.comのURLはoEmbed APIで存在確認。`/status/` なしはプロフィールURLとして却下 |
| Do URL (その他) | GETリクエストでHTTPステータス200台を確認 |

### 通知
| 項目 | 説明 |
|---|---|
| Discord Webhook | URL + `?thread_id=` パラメータでスレッド通知対応 |
| Teams Webhook | MessageCard形式で送信 |
| 通知内容 | 学生名・課題ID・Notion URL・提出週・Do URL・Plan内容(却下時)・判定理由を含む |
| 非通知時間 | 設定シートの「非通知時間」(例: `0:30-9:00`) の間は通知をスキップ |
| HTTP応答ログ | 送信成功時はステータスコード、失敗時は警告ログを出力 |

### ログ・転記
| シート | 操作 | 状態 |
|---|---|---|
| 管理シート「設定」 | ターゲット設定・稼働リミット・非通知時間・転記先情報を読み取り | 実装済み |
| 管理シート「ログ」 | 判定結果を8カラムで追記 (ID, 実行日時, クラスID, 課題名, 判定, 判定理由, Notion URL, シート転記) | 実装済み |
| 転記先シート | 受理データを転記 (ID, 実行日時, クラスID, 判定, Notion URL) | 実装済み |
| 重複抑制 | 同一ID + 同一判定理由のログが既にある場合、通知・ログ記録をスキップ | 実装済み |

### セキュリティ対策
| 項目 | 説明 | 状態 |
|---|---|---|
| サプライチェーン攻撃対策 | `npm ci --ignore-scripts`, `.npmrc` でpostinstall無効化 | 実装済み |
| axios不使用 | 標準 `https`/`http` モジュールのみ使用 | 確認済み |
| Notion READ ONLY | ステータス更新なし。判定結果はログシートにのみ記録 | 実装済み |
| CIログ制御 | `GITHUB_ACTIONS=true` 時はターゲットID・週番号・タイトル等をマスク表示 | 実装済み |
| エラー出力制御 | スタックトレース・URL・リクエスト情報をログに出力しない | 実装済み |
| Actions最小権限 | `permissions: contents: write` (keep-alive用), `persist-credentials: false` | 実装済み |
| JSON キー対策 | GitHub Secretsの前後クォートを自動除去 | 実装済み |

### GitHub Actions
- スケジュール: JST 6:00〜1:59の間30分おき (cron `5,35 0-16,21-23 * * *`)
- JST 2:00〜5:59は実行なし
- push時・workflow_dispatchでも実行可能
- アクションはフルコミットSHAでバージョン固定 (checkout v6.0.2, setup-node v6.4.0)
- Dependabotで依存関係の自動更新監視
- 60日ルール対策: 1日1回 `.last-activity` をコミット

## 必要な環境変数 / Secrets
| 名前 | 説明 | 必須 |
|---|---|---|
| `NOTION_TOKEN` | Notion インテグレーション・トークン | Yes |
| `NOTION_DATABASE_ID` | 宿題DBのID | Yes |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウントJSONキー (生のJSON1行, 前後クォート付き可) | Yes |
| `MANAGEMENT_SPREADSHEET_ID` | システム管理スプレッドシートのID | Yes |
| `ACADEMIC_SPREADSHEET_ID` | 教育運営スプレッドシートのID (任意, 後回し) | No |

## 設定シートのカラム構成
| カラム | プロパティ名 | 説明 |
|---|---|---|
| A | targetId | ターゲットID (例: PO26) |
| B | deadlineWeekday | 締切曜日 |
| C | deadlineTime | 締切時刻 |
| D | unlockWeekday | 解除曜日 |
| E | unlockTime | 解除時刻 |
| F | discordWebhook | Discord Webhook URL |
| G | discordThread | Discord Thread URL (/channels/形式可) |
| H | teamsWebhook | Teams Webhook URL |
| I | quietHours | 非通知時間 (例: `0:30-9:00`) |
| J | operationLimit | 稼働リミット (例: `2026/9/30`) |
| K | transferSheetId | 転記先スプレッドシートID |
| L | transferTabName | 転記先タブ名 (例: `受理宿題`) |
| M | notes | 備考 |

## Notionプロパティ名
| プロパティ名 | タイプ | 用途 |
|---|---|---|
| title | title | 提出タイトル (例: `po26-0101_PO202601_西村和史`) |
| 学生名（確認用） | formula | 学生名テキスト (空または `_` なら未入力扱い) |
| 課題ID(外部参照用) | formula | 課題IDテキスト (例: `po26-0101`) |
| Plan (背景・意図説明・備考)  | rich_text | Plan本文 (150文字以上必要) |
| Do (宿題遂行と提出) 宿題記事をツイートしたTwitter URLなど | url | DoのURL |
| Status | select | `提出済(FB待ち)` で検索 |

## 未実装・今後の候補
- 目安スケジュール連携による自動窓口判定
- エラーリトライ機構 (Sheets API / Notion API rate limit)

## 既知の注意点
- `npm audit` で `uuid` パッケージに moderate 脆弱性あり (googleapis 経由)
- タイムゾーン (JST) の扱いは実環境で要確認
- Discord/Teams Webhook送信のエラーレスポンスハンドリングは最小限
- Notion APIは参照のみ。ステータス更新は行わない