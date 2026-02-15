# Tempo Testnet Daily Activity Bot

## What this does
- Tempo Testnet (Moderato) で faucet 以外の活動を毎日実行し、tx結果を `reports/` に保存してコミットします。

## Sources
- https://docs.tempo.xyz/quickstart/connection-details
- https://docs.tempo.xyz/quickstart/evm-compatibility
- https://docs.tempo.xyz/quickstart/predeployed-contracts

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
- `SINK_ADDRESS` は `TEMPO` の Tip-20 namespace (`0x20c000000000000000000000...`) とゼロアドレスを受け付けません。
- 実行前に各 TIP-20 transfer の `balanceOf(wallet)`、`transferAmount`、`SINK` をログ出力し、`estimateGas` 失敗時は `to/from/data/nonce/feeFields` を含む再スロー情報を出力します。
