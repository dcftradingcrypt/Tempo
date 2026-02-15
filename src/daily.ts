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

function stringifyFeeData(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, raw) => (typeof raw === "bigint" ? `0x${raw.toString(16)}` : raw)
  );
}

function txFailureMessage(
  action: string,
  to: string,
  from: string,
  data: string,
  nonce: number,
  feeFields: Record<string, unknown>,
  cause: unknown
): string {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return `${action} failed. to=${to} from=${from} nonce=${nonce} data=${data} feeFields=${stringifyFeeData(
    feeFields
  )} cause=${reason}`;
}

async function assertTokenDecimals(contract: Contract, expected: number, tokenName: string): Promise<void> {
  const dec: number = Number(await contract.decimals());
  if (dec !== expected) {
    throw new Error(`${tokenName}.decimals mismatch: expected=${expected} actual=${dec}`);
  }
}

async function ensureBalance(
  sender: string,
  sink: string,
  token: Contract,
  tokenName: string,
  amount: bigint
): Promise<void> {
  const balance = await token.balanceOf(sender);
  console.log(
    `[balance] ${tokenName} sender=${sender} sink=${sink} balance=${balance.toString()} transferAmount=${amount.toString()}`
  );

  if (balance < amount) {
    throw new Error(
      `${tokenName} balance insufficient. sender=${sender} token=${token.target as string} balance=${balance.toString()} required=${amount.toString()}`
    );
  }
}

async function main(): Promise<void> {
  const env = loadEnv(process.env as Record<string, unknown>);
  const provider = makeProvider(env.TEMPO_RPC_URL, env.TEMPO_CHAIN_ID);
  await assertChainId(provider, env.TEMPO_CHAIN_ID);

  const wallet = await loadWalletFromEnc(env.WALLET_ENC_PATH, env.WALLET_PASSWORD);
  const signer = wallet.connect(provider);
  const sender = await signer.getAddress();
  const sink = getAddress(env.SINK_ADDRESS_CHECKSUM);

  const dateJst = nowJstDateString();
  const timeJst = nowJstTimeString();
  const amount = parseUnits(env.TRANSFER_AMOUNT, TOKEN_DECIMALS);
  console.log(`sender=${sender}`);
  console.log(`sink=${sink}`);
  console.log(`transferAmount=${amount.toString()}`);

  let nonce = await provider.getTransactionCount(sender, "pending");

  const report: DailyReport = {
    dateJst,
    timeJst,
    chainId: env.TEMPO_CHAIN_ID,
    rpcUrl: env.TEMPO_RPC_URL,
    wallet: sender,
    sink,
    items: []
  };

  for (const t of TOKEN_LIST) {
    const token = new Contract(t.address, ERC20_ABI, signer);
    await assertTokenDecimals(token, TOKEN_DECIMALS, t.name);
    await ensureBalance(sender, sink, token, t.name, amount);

    const overrides = await feeOverrides(provider, nonce);
    const data = token.interface.encodeFunctionData("transfer", [sink, amount]);
    let gasLimit;
    try {
      gasLimit = await token.transfer.estimateGas(sink, amount, overrides);
    } catch (error) {
      throw new Error(
        txFailureMessage(
          `transfer:${t.name} estimateGas`,
          token.target as string,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }

    let tx;
    try {
      tx = await token.transfer(sink, amount, { ...overrides, gasLimit });
    } catch (error) {
      throw new Error(
        txFailureMessage(
          `transfer:${t.name} send`,
          token.target as string,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throw new Error(
        txFailureMessage(
          `transfer:${t.name} waitAndVerify`,
          token.target as string,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }
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
    await ensureBalance(sender, sink, alpha, "AlphaUSD", amount);

    const overrides = await feeOverrides(provider, nonce);
    const data = alpha.interface.encodeFunctionData("approve", [PREDEPLOYED.permit2, MaxUint256]);
    let gasLimit;
    try {
      gasLimit = await alpha.approve.estimateGas(PREDEPLOYED.permit2, MaxUint256, overrides);
    } catch (error) {
      throw new Error(
        txFailureMessage(
          "approve:AlphaUSD->Permit2(MaxUint256) estimateGas",
          PREDEPLOYED.permit2,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }

    let tx;
    try {
      tx = await alpha.approve(PREDEPLOYED.permit2, MaxUint256, { ...overrides, gasLimit });
    } catch (error) {
      throw new Error(
        txFailureMessage(
          "approve:AlphaUSD->Permit2(MaxUint256) send",
          PREDEPLOYED.permit2,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throw new Error(
        txFailureMessage(
          "approve:AlphaUSD->Permit2(MaxUint256) waitAndVerify",
          PREDEPLOYED.permit2,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }
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
    const data = permit2.interface.encodeFunctionData("approve", [
      TOKENS.alphaUSD,
      sink,
      MAX_UINT160,
      MAX_UINT48
    ]);
    let gasLimit;
    try {
      gasLimit = await permit2.approve.estimateGas(
        TOKENS.alphaUSD,
        sink,
        MAX_UINT160,
        MAX_UINT48,
        overrides
      );
    } catch (error) {
      throw new Error(
        txFailureMessage(
          "nonTip20:Permit2.approve estimateGas",
          PREDEPLOYED.permit2,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }

    let tx;
    try {
      tx = await permit2.approve(TOKENS.alphaUSD, sink, MAX_UINT160, MAX_UINT48, { ...overrides, gasLimit });
    } catch (error) {
      throw new Error(
        txFailureMessage(
          "nonTip20:Permit2.approve send",
          PREDEPLOYED.permit2,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throw new Error(
        txFailureMessage(
          "nonTip20:Permit2.approve waitAndVerify",
          PREDEPLOYED.permit2,
          sender,
          data,
          nonce,
          overrides,
          error
        )
      );
    }
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
  if (e instanceof Error && "cause" in e && e.cause instanceof Error) {
    console.error("CAUSE:", e.cause.message);
  }
  process.exit(1);
});
