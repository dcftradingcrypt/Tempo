# Tempo Testnet Daily Activity Bot（faucet除外）

## 目的

Tempo Testnet (Moderato) で **faucet以外** のオンチェーン活動を **毎日** 自動実行する。  
秘密鍵は **暗号化 keystore (.enc)** として保存し、実行時に復号して使用する。  
実行結果（tx hash / receipt / feeToken 等）を `reports/` に保存し、GitHub Actions がコミットする。

## 根拠（参照URL）

- Connection details（RPC/chainId/explorer）: https://docs.tempo.xyz/quickstart/connection-details
- EVM Differences（fee token selection / TIP-20 transferはトークン自体がfee token / 非TIP-20はpathUSD fallback）: https://docs.tempo.xyz/quickstart/evm-compatibility
- Predeployed Contracts（pathUSD/Permit2/Multicall3等のアドレス）: https://docs.tempo.xyz/quickstart/predeployed-contracts
- Explorer（tx URL形式）: https://explore.tempo.xyz/tx/<hash>

## 仕様（固定）

### ネットワーク

- RPC: `https://rpc.moderato.tempo.xyz`
- chainId: `42431`
- Explorer tx: `https://explore.tempo.xyz/tx/<hash>`

### 毎日の活動（必ず実トランザクション）

1. TIP-20 transfer（最低1件、実装は4件）
- pathUSD / AlphaUSD / BetaUSD / ThetaUSD を `SINK_ADDRESS` に送付

2. TIP-20 approve（最低1件）
- AlphaUSD が Permit2 に `MaxUint256` allowance を付与（`approve(PERMIT2, MaxUint256)`）

3. 非TIP-20コントラクト呼び出し（最低1件）
- Predeployed Permit2 に対して `approve(token, spender, amount, expiration)` を送る
- `Permit2.approve(AlphaUSD, SINK_ADDRESS, MaxUint160, MaxUint48)`

> faucetは禁止。`tempo_fundAddress` 等は一切実装しない。

### 秘密鍵

- 平文保存禁止
- `secrets/wallet.enc` に **ethers keystore JSON**（暗号化済み）を保存
- 復号は実行時に `WALLET_PASSWORD` で行う（ログに秘密鍵/パスワードは出さない）

### 出力（必須）

- `reports/YYYY-MM-DD/run-HHMMSS.json` を生成（JST基準）
- JSONには必ず以下を含む:
- wallet address / chainId / rpcUrl / sink
- 各tx: hash / explorer URL
- `eth_getTransactionReceipt` の raw 取得結果（feeToken / feePayer を含む）
- gasUsed / effectiveGasPrice

### GitHub Actions

- schedule（毎日）
- workflow_dispatch（手動）
- 実行後 `reports/` の追加を commit & push

## リポジトリ構成

```txt
.
├─ .github/workflows/daily.yml
├─ .gitignore
├─ CLAUDE.md
├─ CODEX_TASK.md
├─ README.md
├─ package.json
├─ tsconfig.json
├─ eslint.config.js
├─ src/
│  ├─ abi/
│  │  ├─ erc20.ts
│  │  └─ permit2.ts
│  ├─ lib/
│  │  ├─ dateJst.ts
│  │  ├─ env.ts
│  │  ├─ keystore.ts
│  │  ├─ provider.ts
│  │  ├─ report.ts
│  │  └─ tx.ts
│  ├─ tempo.ts
│  └─ daily.ts
├─ scripts/
│  ├─ encrypt-wallet.ts
│  └─ show-address.ts
└─ secrets/
   └─ wallet.enc
```
