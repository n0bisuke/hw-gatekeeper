# 現在の実装状態

> 最終更新: 2026-04-30

## プロジェクト概要
Notionの宿題データベースを定期的に監視し、提出期限内かつ内容に不備がないものだけを教員用スプレッドシートへ転記する「門番（ゲートキーパー）」システム。
不備や期限外の提出は自動的に却下し、Discord/Teamsへ理由を通知する。

## 現在のバージョン
- Version: 1.0.0 (開発中)
- Node.js v20+
- GitHub Actions で 30分おきに自動実行

## 実装済み機能

### コアモジュール
| モジュール | 説明 | 状態 |
|---|---|---|
| `src/notion-client` | Notion API (READ ONLY, ターゲットID絞り込み検索, バリデーション用データ取得) | 実装済み |
| `src/sheets-client` | Google Sheets API (設定読み取り, ログ書き込み, スケジュール読み取り, FB転記) | 実装済み |
| `src/scheduler` | 提出窓口判定 (UnlockDateTime〜DeadlineDateTimeの範囲チェック) | 実装済み (教育運営シート連携時に有効化) |
| `src/validator` | バリデーション (学生名・宿題リレーション, Plan文字数, Do URL) | 実装済み |
| `src/notifier` | Discord/Teams Webhook通知 (標準httpsモジュール, axios不使用) | 実装済み |
| `src/main` | メイン実行フロー (設定読込→Notion取得→バリデーション→ログ/転記/通知) | 実装済み |

### セキュリティ対策
| 項目 | 説明 | 状態 |
|---|---|---|
| サプライチェーン攻撃対策 | `npm ci --ignore-scripts`, `.npmrc` でpostinstall無効化 | 実装済み |
| axios不使用 | 標準 `https`/`http` モジュールのみ使用 | 確認済み |
| Notion READ ONLY | ステータス更新なし。判定結果はログシートにのみ記録 | 実装済み |
| CIログ制御 | `GITHUB_ACTIONS=true` 時は学生名をマスク表示 | 実装済み |
| エラー出力制御 | スタックトレース・URL・リクエスト情報をログに出力しない | 実装済み |
| 最小権限Actions | `permissions: {}`, `persist-credentials: false` | 実装済み |

### Google Sheets連携
| シート | 操作 | 状態 |
|---|---|---|
| 管理シート「設定」 | ターゲット設定・稼働リミットを読み取り | 実装済み |
| 管理シート「ログ」 | 判定結果（受理/却下）と理由を追記 | 実装済み |
| 教育運営「目安スケジュール」 | 週番号と基準日を読み取り (任意) | 実装済み (後回し) |
| 教育運営「実装授業とFB（教員記入）」 | 合格データのNotion URLを追記 (任意) | 実装済み (後回し) |

### GitHub Actions
- スケジュール: 毎時5分/35分 (30分間隔, cron `5,35 * * * *`) + 手動トリガー対応
- アクションはフルコミットSHAでバージョン固定
- Dependabot で依存関係の自動更新監視

## 必要な環境変数 / Secrets
| 名前 | 説明 | 必須 |
|---|---|---|
| `NOTION_TOKEN` | Notion インテグレーション・トークン | Yes |
| `NOTION_DATABASE_ID` | 宿題DBのID | Yes |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | サービスアカウントJSONキー (生のJSON1行) | Yes |
| `MANAGEMENT_SPREADSHEET_ID` | システム管理スプレッドシートのID | Yes |
| `ACADEMIC_SPREADSHEET_ID` | 教育運営スプレッドシートのID | No |

## ファイル構成

```
po-shukudai-monban/
├── index.js                        # エントリーポイント
├── package.json
├── .env.example
├── .npmrc                          # セキュリティ設定
├── .gitignore
├── CLAUDE.md
├── AGENTS.md
├── docs/
│   ├── SPEC.md                     # 仕様書
│   ├── current-state.md            # 本ファイル
│   ├── setup.md                    # セットアップガイド
│   └── 仕様認識.md                  # 認識擦り合わせメモ
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       └── gatekeeper.yml          # GitHub Actions (30分おきcron)
└── src/
    ├── config.js                   # 定数・設定値
    ├── main.js                     # メイン実行フロー
    ├── notion-client.js            # Notion API (READ ONLY)
    ├── sheets-client.js            # Google Sheets API
    ├── scheduler.js                # 提出窓口判定
    ├── validator.js                # バリデーション
    └── notifier.js                 # Discord/Teams通知
```

## 未実装・今後の候補
- 教育運営スプレッドシート (`ACADEMIC_SPREADSHEET_ID`) の実運用
- 目安スケジュール連携による自動窓口判定
- 教員FBシートへの自動転記 (備考=本科)
- エラーリトライ機構 (Sheets API / Notion API rate limit)
- ログシートの詳細定義 (現在は6カラム固定)

## 既知の注意点
- `npm audit` で `uuid` パッケージに moderate 脆弱性あり (googleapis 経由)
- タイムゾーン (JST) の扱いは実環境で要確認
- Discord/Teams Webhook送信のエラーレスポンスハンドリングは最小限
- GitHub Actionsは60日間コミットがないとスケジュール実行が自動停止される
- Notion APIは参照のみ。ステータス更新は行わない
