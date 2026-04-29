# AGENTS.md

## プロジェクト概要
- **GATEKEEPER**: Notionの宿題データベースを定期的に監視し、提出期限内かつ内容に不備がないものだけを教員用スプレッドシートへ転記する「門番」システム
- 不備や期限外の提出は自動的に却下（ステータス差し戻し）し、Discord/Teamsへ詳細な理由を通知する
- ユーザーが明示した要件の範囲で変更し、要件を勝手に追加しないこと

## 作業ルール
- 実装や設計を進める前に、まずユーザーの要件を正確に把握すること。
- 実装に影響する前提が不足している場合は、先にヒアリングすること。
- 推測ベースの大きなリファクタではなく、段階的な実装を優先すること。
- ユーザーから依頼がない限り、既存の方向性を勝手に変えないこと。
- 引き継ぎで開発を再開する際は、前回の課題と今回触る範囲を最初に短く確認してから着手すること。
- 着手後の軽微なバグ調整や切り分けは逐一許可待ちにせず、小さく直して検証まで進めること。
- ユーザー要件を広げる変更は避けること。特に未依頼の機能追加は行わないこと。

## コード方針
- Node.js v20+ を使う。
- 1ファイルあたり約400行以下を目安にすること。大きくなったら責務ごとに分割する。
- 外部パッケージ: `@notionhq/client`, `googleapis`, `dayjs`。HTTP通信は標準 `https`/`http` モジュールを使用。
- コメントは最小限にし、非自明な処理にだけ付けること。
- 秘密情報（APIキー、認証情報等）はソースコードにハードコードせず環境変数で渡すこと。
- `index.js` はエントリーポイントのみ。ビジネスロジックは `src/` に分離する。

## ファイル構成

```
po-shukudai-monban/
├── index.js                        # エントリーポイント
├── package.json
├── package-lock.json
├── .env.example
├── .npmrc                          # サプライチェーン攻撃対策設定
├── CLAUDE.md
├── AGENTS.md
├── docs/
│   └── current-state.md            # 実装状態サマリ
├── .github/
│   ├── dependabot.yml              # 自動依存関係更新
│   └── workflows/
│       └── gatekeeper.yml          # GitHub Actions (毎時5分cron + 手動)
└── src/
    ├── config.js                   # 定数・設定値
    ├── main.js                     # メイン実行フロー
    ├── notion-client.js            # Notion API ラッパー
    ├── sheets-client.js            # Google Sheets API ラッパー
    ├── scheduler.js                # 提出窓口判定ロジック
    ├── validator.js                # バリデーション
    └── notifier.js                 # Discord/Teams 通知
```

### 分割ルール
- 各外部API連携は `src/<service>-client.js` に分割する。
- 新しいAPI連携を追加する場合は対応する `src/<service>-client.js` を作成し、`src/main.js` で統合する。
- ビジネスロジック（判定・検証）は `src/scheduler.js`, `src/validator.js` に配置する。

## 処理フロー
1. **設定読み込み**: Google Sheetsから「設定」シートと「目安スケジュール」シートを取得
2. **提出取得**: Notionから `Status = "提出済(FB待ち)"` のページを取得
3. **タイトル解析**: `PO26-03` 形式から週番号とターゲットIDを抽出
4. **窓口判定**: 設定と目安スケジュールから `UnlockDateTime` 〜 `DeadlineDateTime` を生成し、現在時刻が範囲内かチェック
5. **バリデーション**: 学生名・宿題リレーションの有無、Planの文字数、DoのURL入力を確認
6. **アクション実行**:
   - **受理**: NotionのStatusを「受理済み(FB待ち)」に更新。備考が「本科」なら教員用シートにNotion URLを追記。Discord/Teamsへ受理通知
   - **却下**: NotionのStatusを「提出前(要修正)」に差し戻し。理由をDiscord/Teamsへ通知。シート転記は行わない

## ログ・記録ルール
「ログに残して」「記録して」などの指示があった場合、以下を更新すること：
1. `docs/current-state.md` — 実装状態サマリ（必須）
2. `AGENTS.md` のステータス欄 — ステータスが大きく変わった場合のみ

## 現在のステータス
- フェーズ: 基本実装完了、動作検証待ち
- 詳細な実装状態は `docs/current-state.md` を参照

## 検証
- コード変更後は `npm install` と `node index.js`（または該当モジュールの単体実行）で構文エラーがないことを確認すること。
- Notion API/Google Sheets APIのテストは実際のAPI呼び出しが必要。モックなしで検証すること。
- GitHub Actionsのワークフロー変更後は `git push` してActionsタブで実行確認すること。
- 未実装の部分がある場合は、その点を明確に伝えること。
