# CLAUDE.md — Non-negotiables / Mistake Log

## Non-negotiables (絶対遵守)
- 推測・一般論で断定しない（根拠: 実コード/実ログ/実行結果/参照URL）
- 例外の握りつぶし禁止（catchして黙殺/ログ無効化/バリデーション無効化/リトライで隠す/フィーチャーフラグで止める等）
- 安易なワークアラウンド禁止（タイムアウト増やす、リトライ増やすだけ等）
- faucet関連コードを入れない（tempo_fundAddress等）
- 仕様変更を伴う広範囲リファクタや破壊的変更禁止
- 証拠なしの原因特定・修正確定禁止

## Definition of Done
- `npm ci && npm run lint && npm test` が通る
- `npm run run:daily` が reports/ に JSON を生成する
- GitHub Actions が毎日実行し、reports/ を commit する

## Mistake Log（修正のたびに必ず追記する）
フォーマット（必須）:
- Date:
- Symptom:
- Evidence (ログ/tx/stacktrace/URL):
- Root Cause:
- Fix:
- Prevent Recurrence (テスト/チェック追加内容):
- Files Changed:
