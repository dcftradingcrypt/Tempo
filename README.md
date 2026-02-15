# Tempo Testnet Daily Activity Bot

Tempo Testnet (Moderato) で faucet を使わずに毎日オンチェーン活動を実行し、結果を `reports/YYYY-MM-DD/run-*.json` に保存する TypeScript bot です。

## 根拠URL

- Connection details (RPC / chainId / explorer): https://docs.tempo.xyz/quickstart/connection-details
- EVM compatibility differences (TIP-20 fee token behavior, fallback fee token): https://docs.tempo.xyz/quickstart/evm-compatibility
- Predeployed contracts (pathUSD, Permit2): https://docs.tempo.xyz/quickstart/predeployed-contracts
- Faucet page (AlphaUSD/BetaUSD/ThetaUSD addresses): https://docs.tempo.xyz/quickstart/faucet
- Explorer tx URL format: https://explore.tempo.xyz/tx/<hash>

## 固定仕様

- RPC: `https://rpc.moderato.tempo.xyz`
- Chain ID: `42431`
- Permit2: `0x000000000022d473030f116ddee9f6b43ac78ba3`
- Tokens:
  - `pathUSD`: `0x4A0d1092E9df255cf95D72834Ea9255132782318`
  - `AlphaUSD`: `0x8A900D1D24ED6046ecEa37677000E112D47fA58c`
  - `BetaUSD`: `0xC5A5b43180192C3Ba6E5E360Dc7E8D5eD6921F55`
  - `ThetaUSD`: `0xB0f7858f5c8c6fC6656C6B317C80813DF9EC5aE9`

毎日の実トランザクション:

1. TIP-20 transfer: `pathUSD`, `AlphaUSD`, `BetaUSD`, `ThetaUSD`
2. TIP-20 approve: `AlphaUSD.approve(Permit2, MaxUint256)`
3. 非TIP-20 call: `Permit2.approve(AlphaUSD, SINK_ADDRESS, MaxUint160, MaxUint48)`

## セットアップ

1. 依存関係のインストール

```bash
npm ci
```

2. 暗号化 keystore を作成（平文秘密鍵は保存しない）

```bash
PRIVATE_KEY=0x... WALLET_PASSWORD='your-password' npm run encrypt-wallet
```

出力先はデフォルト `secrets/wallet.enc`（`OUT_PATH` で変更可）。

3. 実行

```bash
WALLET_PASSWORD='your-password' \
SINK_ADDRESS='0xYourSinkAddress' \
npm run run:daily
```

## 環境変数

- `WALLET_PASSWORD` (必須)
- `SINK_ADDRESS` (必須)
- `WALLET_ENC_PATH` (任意, default: `secrets/wallet.enc`)
- `REPORT_BASE_DIR` (任意, default: `reports`)
- `TRANSFER_AMOUNT_WEI` (任意, default: `1`)

## レポート形式

各 tx について次を保存します。

- `hash`
- `explorerUrl`
- `rawReceipt` (`eth_getTransactionReceipt` の生データ)
- `gasUsed`
- `effectiveGasPrice`
- `feeToken`
- `feePayer`

## GitHub Actions

`.github/workflows/daily.yml` は次を満たします。

- `schedule`: 毎日 JST 09:15（cron は UTC `15 0 * * *`）
- `workflow_dispatch`: 手動実行
- 実行成功後 `reports/` を commit & push

必要な GitHub Secrets:

- `WALLET_PASSWORD`
- `SINK_ADDRESS`

## 注意

- faucet 呼び出しコードは実装していません。
- `secrets/wallet.enc` は暗号化 JSON を commit 可能ですが、パスワードは必ず GitHub Secrets で管理してください。
- 同梱の `secrets/wallet.enc` はランダム生成した未資金サンプルです。運用前に funded ウォレットの暗号化 keystore に差し替えてください。
