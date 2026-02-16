# Tempo Testnet Daily Activity Bot

## What this does
- Tempo Testnet (Moderato) で faucet 以外の活動を毎日実行し、tx結果を `reports/` に保存してコミットします。

## Sources
- https://docs.tempo.xyz/quickstart/connection-details
- https://docs.tempo.xyz/quickstart/evm-compatibility
- https://docs.tempo.xyz/quickstart/predeployed-contracts
- https://docs.tempo.xyz/protocol/fees/spec-fee
- https://docs.tempo.xyz/protocol/fees/spec-fee-amm
- https://docs.tempo.xyz/protocol/tip20/spec
- https://docs.tempo.xyz/protocol/tip403/spec
- https://docs.chainstack.com/reference/tempo-eth-gettransactionreceipt

## Setup (local)
1. Install
```bash
npm ci
```

2. Create encrypted wallet (writes `secrets/wallet.enc`)
```bash
npm run encrypt:wallet
```

3. Create `.env` (DO NOT COMMIT)
```dotenv
WALLET_PASSWORD=your_password
SINK_ADDRESS=0xYourSinkAddress
```

4. Confirm address
```bash
npm run show:address
```

5. Run once
```bash
npm run run:daily
```

## Setup (GitHub Actions)

Add Repository Secrets:
- `WALLET_PASSWORD`
- `SINK_ADDRESS`

Optional Repository Variable:
- `TRANSFER_AMOUNT` (default `"1"`)

## Notes
- faucet（`tempo_fundAddress` 等）は実装に含みません。
- 失敗時は `exit code != 0` で落ち、握りつぶしません。
- `SINK_ADDRESS` はゼロアドレスと TIP-20 namespace（`0x20c000000000000000000000...`）を受け付けません（TIP-20 Invalid Recipient Protection）。
- 実行前に TIP-20 `paused/currency/transferPolicyId/TIP-403 isAuthorized(sender/recipient|spender)` と transfer 残高、`max_fee` に対する alphaUSD 残高を検証します。
- 失敗時は `reports/YYYY-MM-DD/run-*.failure.json` を出力し、`step/preflight/error` を残して `exit(1)` します。
