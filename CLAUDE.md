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
- Date: 2026-02-16
- Symptom:
  - `run:daily` が `missing revert data (action=\"estimateGas\")` で停止し、トランザクション原因（宛先/データ/残高）を確定できなかった
- Evidence (ログ/tx/stacktrace/URL):
  - 実ログ: `FATAL: ... missing revert data`
  - 事前検証で `transfer` 実行前の残高不一致を確認できる設計が未実装だった
- Root Cause:
  - 送信前ガードが不足し、`estimateGas` が内部で revert しても tx コンテキストが欠落していた
- Fix:
  - `src/lib/env.ts` で `SINK_ADDRESS` のゼロアドレス禁止を追加
  - `src/lib/env.test.ts` にゼロアドレス拒否テストを追加
  - `src/daily.ts` で transfer/approve 前に `balanceOf` と `sink`/`amount` をログ出力
  - `src/daily.ts` で `estimateGas/send/waitAndVerify` 失敗時に `to/from/data/nonce/feeFields` を含む再送信可能なエラーログで rethrow
- Prevent Recurrence (テスト/チェック追加内容):
  - `src/lib/env.test.ts` のゼロアドレス拒否テスト
- Files Changed:
  - `src/lib/env.ts`
  - `src/lib/env.test.ts`
  - `src/daily.ts`

- Date: 2026-02-16
- Symptom:
  - `run:daily` が `missing revert data` (`estimateGas`) で停止し、`SINK` が誤った種類（ゼロ/Token宛先）または残高不足による失敗が切り分けできなかった
- Evidence (ログ/tx/stacktrace/URL):
  - `FATAL: missing revert data ... estimateGas ...`
  - `SINK_ADDRESS` が `0x000...0000` または `0x20c000...` の場合は事前チェックを追加する前提
- Root Cause:
  - 送信前の必須バリデーション（Sink 妥当性・残高）と失敗時コンテキスト（to/from/data/nonce/feeFields）をログへ必須化していなかった
- Fix:
  - `src/lib/env.ts` で `SINK_ADDRESS` をゼロアドレス、TIP-20 prefix（`0x20c000000000000000000000`）で即エラー
  - `src/lib/env.test.ts` にゼロ/`TIP-20 prefix`拒否テストを追加
  - `src/daily.ts` で transfer 前に `balanceOf` と `transferAmount/sink` をトークン別にログ出力
  - `src/daily.ts` で `estimateGas/send/waitAndVerify` 失敗時に `to/from/data/nonce/feeFields` を含む再送信可能なエラーメッセージへ rethrow
- Prevent Recurrence (テスト/チェック追加内容):
  - `src/lib/env.test.ts`（ゼロアドレス／TIP-20 prefix拒否テスト）
- Files Changed:
  - `src/lib/env.ts`
  - `src/lib/env.test.ts`
  - `src/daily.ts`
  - `README.md`
  - `CLAUDE.md`
