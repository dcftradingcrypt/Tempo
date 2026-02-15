# CLAUDE.md

## Purpose

このリポジトリの実装・修正時に、発生した不具合と再発防止を記録する。

## Update Rule (mandatory)

バグ・不具合・想定外挙動を修正したときは、同じコミット内で必ず `Mistake Log` を更新する。

各エントリに必ず記載する項目:

- What happened: 何が起きたか
- Root cause: 根本原因
- Prevention: 再発防止（追加したテスト/チェック）

## Mistake Log

- 2026-02-15
  - What happened: `src/tempo.ts` の token 定数読み込み時に `INVALID_ARGUMENT: bad address checksum` が発生し、テスト実行が失敗した。
  - Root cause: docs 表記の mixed-case 文字列をそのまま `getAddress()` に渡したため、checksum 不一致として reject された。
  - Prevention: token 定数入力値を lowercase に統一し `getAddress()` で正規化。`tests/tx.test.ts` で `src/lib/tx.ts` 経由 import を通し、定数初期化エラーが再発するとテストで検知される状態にした。

- 2026-02-15
  - What happened: `npm run build` で `Cannot invoke an object which is possibly 'undefined'` と `Wallet | HDNodeWallet` 型不一致で失敗した。
  - Root cause: `ethers.Contract` の動的メソッドを厳密型で扱っておらず、keystore 復号戻り型も union を考慮していなかった。
  - Prevention: `src/daily.ts` に `Erc20Writer` / `Permit2Writer` を明示し、`src/lib/keystore.ts` と `src/lib/tx.ts` を union 対応へ修正。`npm run build` を検証手順に固定して型崩れを継続検出する。
