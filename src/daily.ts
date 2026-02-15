import "dotenv/config";
import { Contract, MaxUint256, getAddress, parseUnits } from "ethers";
import { ERC20_ABI } from "./abi/erc20.js";
import { PERMIT2_ABI } from "./abi/permit2.js";
import { PREDEPLOYED, TEMPO, TOKEN_DECIMALS, TOKENS } from "./tempo.js";
import { nowJstDateString, nowJstTimeString } from "./lib/dateJst.js";
import { loadEnv } from "./lib/env.js";
import { loadWalletFromEnc } from "./lib/keystore.js";
import { assertChainId, makeProvider } from "./lib/provider.js";
import { feeOverrides, fetchRawReceipt, waitAndVerify } from "./lib/tx.js";
import { writeReport, type DailyReport } from "./lib/report.js";

type TokenSpec = { name: string; address: string };

const TOKEN_LIST: TokenSpec[] = [
  { name: "pathUSD", address: TOKENS.pathUSD },
  { name: "AlphaUSD", address: TOKENS.alphaUSD },
  { name: "BetaUSD", address: TOKENS.betaUSD },
  { name: "ThetaUSD", address: TOKENS.thetaUSD }
];

function explorerUrl(txHash: string): string {
  return `${TEMPO.explorerTxBase}${txHash}`;
}

async function assertTokenDecimals(contract: Contract, expected: number, tokenName: string): Promise<void> {
  const dec: number = Number(await contract.decimals());
  if (dec !== expected) {
    throw new Error(`${tokenName}.decimals mismatch: expected=${expected} actual=${dec}`);
  }
}

async function main(): Promise<void> {
  const env = loadEnv(process.env as Record<string, unknown>);
  const provider = makeProvider(env.TEMPO_RPC_URL, env.TEMPO_CHAIN_ID);
  await assertChainId(provider, env.TEMPO_CHAIN_ID);

  const wallet = await loadWalletFromEnc(env.WALLET_ENC_PATH, env.WALLET_PASSWORD);
  const signer = wallet.connect(provider);

  const sink = getAddress(env.SINK_ADDRESS_CHECKSUM);

  const dateJst = nowJstDateString();
  const timeJst = nowJstTimeString();

  const amount = parseUnits(env.TRANSFER_AMOUNT, TOKEN_DECIMALS);

  let nonce = await provider.getTransactionCount(await signer.getAddress(), "pending");

  const report: DailyReport = {
    dateJst,
    timeJst,
    chainId: env.TEMPO_CHAIN_ID,
    rpcUrl: env.TEMPO_RPC_URL,
    wallet: await signer.getAddress(),
    sink,
    items: []
  };

  for (const t of TOKEN_LIST) {
    const token = new Contract(t.address, ERC20_ABI, signer);
    await assertTokenDecimals(token, TOKEN_DECIMALS, t.name);

    const overrides = await feeOverrides(provider, nonce);
    const gasLimit = await token.transfer.estimateGas(sink, amount, overrides);
    const tx = await token.transfer(sink, amount, { ...overrides, gasLimit });

    await waitAndVerify(tx);
    const rawReceipt = await fetchRawReceipt(provider, tx.hash);

    report.items.push({
      name: `transfer:${t.name}`,
      hash: tx.hash,
      explorer: explorerUrl(tx.hash),
      receipt: rawReceipt
    });

    nonce += 1;
  }

  {
    const alpha = new Contract(TOKENS.alphaUSD, ERC20_ABI, signer);
    await assertTokenDecimals(alpha, TOKEN_DECIMALS, "AlphaUSD");

    const overrides = await feeOverrides(provider, nonce);
    const gasLimit = await alpha.approve.estimateGas(PREDEPLOYED.permit2, MaxUint256, overrides);
    const tx = await alpha.approve(PREDEPLOYED.permit2, MaxUint256, { ...overrides, gasLimit });

    await waitAndVerify(tx);
    const rawReceipt = await fetchRawReceipt(provider, tx.hash);

    report.items.push({
      name: "approve:AlphaUSD->Permit2(MaxUint256)",
      hash: tx.hash,
      explorer: explorerUrl(tx.hash),
      receipt: rawReceipt
    });

    nonce += 1;
  }

  {
    const permit2 = new Contract(PREDEPLOYED.permit2, PERMIT2_ABI, signer);

    const MAX_UINT160 = (1n << 160n) - 1n;
    const MAX_UINT48 = (1n << 48n) - 1n;

    const overrides = await feeOverrides(provider, nonce);
    const gasLimit = await permit2.approve.estimateGas(
      TOKENS.alphaUSD,
      sink,
      MAX_UINT160,
      MAX_UINT48,
      overrides
    );

    const tx = await permit2.approve(TOKENS.alphaUSD, sink, MAX_UINT160, MAX_UINT48, { ...overrides, gasLimit });

    await waitAndVerify(tx);
    const rawReceipt = await fetchRawReceipt(provider, tx.hash);

    report.items.push({
      name: "nonTip20:Permit2.approve(AlphaUSD,SINK,MaxUint160,MaxUint48)",
      hash: tx.hash,
      explorer: explorerUrl(tx.hash),
      receipt: rawReceipt
    });

    nonce += 1;
  }

  const out = await writeReport(report);
  console.log(`OK: wrote report ${out}`);
  console.log(`wallet=${report.wallet} sink=${report.sink} chainId=${report.chainId}`);
  for (const item of report.items) {
    console.log(`${item.name}: ${item.hash} ${item.explorer}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
