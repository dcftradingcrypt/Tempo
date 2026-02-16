import "dotenv/config";
import { Contract, MaxUint256, getAddress, parseUnits } from "ethers";
import { ERC20_ABI } from "./abi/erc20.js";
import { FEE_MANAGER_ABI } from "./abi/feeManager.js";
import { PERMIT2_ABI } from "./abi/permit2.js";
import { TIP403_ABI } from "./abi/tip403.js";
import { PREDEPLOYED, TEMPO, TOKEN_DECIMALS, TOKENS } from "./tempo.js";
import { nowJstDateString, nowJstTimeString } from "./lib/dateJst.js";
import { loadEnv } from "./lib/env.js";
import { attodollarsToMicrodollarsCeil } from "./lib/feeMath.js";
import { loadWalletFromEnc } from "./lib/keystore.js";
import { assertChainId, makeProvider } from "./lib/provider.js";
import { makeReportTx, writeFailureReport, writeReport, type DailyReport, type FailureReport } from "./lib/report.js";
import { feeOverrides, fetchRawReceipt, waitAndVerify } from "./lib/tx.js";

type TokenSpec = { name: string; address: string };
type RunState = Omit<FailureReport, "error">;

type TxFailureContext = {
  action: string;
  to: string;
  from: string;
  data: string;
  nonce: number;
  feeFields: Record<string, unknown>;
  tokenName?: string;
  tokenAddress?: string;
  sink?: string;
  amount?: bigint;
  balance?: bigint;
};

const TOKEN_LIST: TokenSpec[] = [
  { name: "pathUSD", address: TOKENS.pathUSD },
  { name: "AlphaUSD", address: TOKENS.alphaUSD },
  { name: "BetaUSD", address: TOKENS.betaUSD },
  { name: "ThetaUSD", address: TOKENS.thetaUSD }
];

const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;
const EXPECTED_CURRENCY = "USD";

function explorerUrl(txHash: string): string {
  return `${TEMPO.explorerTxBase}${txHash}`;
}

function stringifyForLog(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, raw) => (typeof raw === "bigint" ? raw.toString() : raw)
  );
}

function setStep(state: RunState, step: string): void {
  state.step = step;
  console.log(`step=${step}`);
}

function recordPreflight(state: RunState, entry: Record<string, unknown>): void {
  state.preflight.push({ step: state.step, ...entry });
}

function getGasPriceForMaxFee(feeFields: Record<string, unknown>): bigint {
  const maxFeePerGas = feeFields.maxFeePerGas;
  if (typeof maxFeePerGas === "bigint") {
    return maxFeePerGas;
  }

  const gasPrice = feeFields.gasPrice;
  if (typeof gasPrice === "bigint") {
    return gasPrice;
  }

  throw new Error(`fee fields missing usable gas price: ${stringifyForLog(feeFields)}`);
}

function txFailureMessage(context: TxFailureContext, cause: unknown): string {
  const reason = cause instanceof Error ? cause.message : String(cause);
  return `${context.action} failed. token=${context.tokenName ?? "n/a"} tokenAddress=${context.tokenAddress ?? "n/a"} to=${context.to} wallet=${context.from} sink=${context.sink ?? "n/a"} amount=${context.amount?.toString() ?? "n/a"} balance=${context.balance?.toString() ?? "n/a"} nonce=${context.nonce} data=${context.data} feeFields=${stringifyForLog(context.feeFields)} cause=${reason}`;
}

function throwTxFailure(context: TxFailureContext, cause: unknown): never {
  const message = txFailureMessage(context, cause);
  console.error(message);
  throw new Error(message);
}

async function assertTokenDecimals(contract: Contract, expected: number, tokenName: string): Promise<void> {
  const decimals = Number(await contract.decimals());
  if (decimals !== expected) {
    throw new Error(`${tokenName}.decimals mismatch: expected=${expected} actual=${decimals}`);
  }
}

async function assertTip20Preflight(
  state: RunState,
  token: Contract,
  tokenName: string,
  tokenAddress: string,
  sender: string,
  counterpartAddress: string,
  counterpartRole: "recipient" | "spender",
  tip403Registry: Contract
): Promise<void> {
  const paused = Boolean(await token.paused());
  const currency = String(await token.currency());
  const policyId = BigInt(await token.transferPolicyId());
  const senderAuthorized = Boolean(await tip403Registry.isAuthorized(policyId, sender));
  const counterpartAuthorized = Boolean(await tip403Registry.isAuthorized(policyId, counterpartAddress));

  recordPreflight(state, {
    check: "tip20Policy",
    tokenName,
    tokenAddress,
    paused,
    currency,
    policyId: policyId.toString(),
    sender,
    senderAuthorized,
    counterpartRole,
    counterpartAddress,
    counterpartAuthorized
  });

  if (paused) {
    throw new Error(`${tokenName} is paused. token=${tokenAddress}`);
  }
  if (currency !== EXPECTED_CURRENCY) {
    throw new Error(`${tokenName} currency mismatch. token=${tokenAddress} expected=${EXPECTED_CURRENCY} actual=${currency}`);
  }
  if (!senderAuthorized) {
    throw new Error(
      `${tokenName} TIP-403 sender unauthorized. token=${tokenAddress} policyId=${policyId.toString()} sender=${sender}`
    );
  }
  if (!counterpartAuthorized) {
    throw new Error(
      `${tokenName} TIP-403 ${counterpartRole} unauthorized. token=${tokenAddress} policyId=${policyId.toString()} ${counterpartRole}=${counterpartAddress}`
    );
  }
}

async function getTransferBalanceOrThrow(
  state: RunState,
  token: Contract,
  tokenName: string,
  tokenAddress: string,
  sender: string,
  sink: string,
  amount: bigint
): Promise<bigint> {
  const balance = BigInt(await token.balanceOf(sender));

  console.log(
    `[balance] token=${tokenName} tokenAddress=${tokenAddress} wallet=${sender} sink=${sink} balance=${balance.toString()} transferAmount=${amount.toString()}`
  );

  recordPreflight(state, {
    check: "transferBalance",
    tokenName,
    tokenAddress,
    wallet: sender,
    sink,
    balance: balance.toString(),
    required: amount.toString()
  });

  if (balance < amount) {
    throw new Error(
      `${tokenName} balance insufficient. wallet=${sender} token=${tokenAddress} sink=${sink} balance=${balance.toString()} required=${amount.toString()}`
    );
  }

  return balance;
}

async function assertAlphaFeeBudget(
  state: RunState,
  alphaToken: Contract,
  sender: string,
  gasLimit: bigint,
  feeFields: Record<string, unknown>,
  txName: string
): Promise<void> {
  const gasPrice = getGasPriceForMaxFee(feeFields);
  const maxFeeAttodollars = gasLimit * gasPrice;
  const requiredMicro = attodollarsToMicrodollarsCeil(maxFeeAttodollars);
  const alphaBalance = BigInt(await alphaToken.balanceOf(sender));

  console.log(
    `[fee-precheck] tx=${txName} feeToken=${TOKENS.alphaUSD} wallet=${sender} alphaBalance=${alphaBalance.toString()} gasLimit=${gasLimit.toString()} gasPrice=${gasPrice.toString()} maxFeeAttodollars=${maxFeeAttodollars.toString()} requiredMicro=${requiredMicro.toString()}`
  );

  recordPreflight(state, {
    check: "feeBudget",
    txName,
    feeToken: TOKENS.alphaUSD,
    wallet: sender,
    alphaBalance: alphaBalance.toString(),
    gasLimit: gasLimit.toString(),
    gasPrice: gasPrice.toString(),
    maxFeeAttodollars: maxFeeAttodollars.toString(),
    requiredMicro: requiredMicro.toString()
  });

  if (alphaBalance < requiredMicro) {
    throw new Error(
      `${txName} fee balance insufficient. wallet=${sender} feeToken=${TOKENS.alphaUSD} alphaBalance=${alphaBalance.toString()} requiredMicro=${requiredMicro.toString()} gasLimit=${gasLimit.toString()} gasPrice=${gasPrice.toString()}`
    );
  }
}

async function runDaily(state: RunState): Promise<void> {
  const env = loadEnv(process.env as Record<string, unknown>);
  state.chainId = env.TEMPO_CHAIN_ID;
  state.rpcUrl = env.TEMPO_RPC_URL;

  const provider = makeProvider(env.TEMPO_RPC_URL, env.TEMPO_CHAIN_ID);
  await assertChainId(provider, env.TEMPO_CHAIN_ID);

  const wallet = await loadWalletFromEnc(env.WALLET_ENC_PATH, env.WALLET_PASSWORD);
  const signer = wallet.connect(provider);
  const sender = await signer.getAddress();
  const sink = getAddress(env.SINK_ADDRESS_CHECKSUM);

  state.wallet = sender;
  state.sink = sink;

  const amount = parseUnits(env.TRANSFER_AMOUNT, TOKEN_DECIMALS);
  console.log(`wallet=${sender}`);
  console.log(`sink=${sink}`);
  console.log(`transferAmount=${amount.toString()}`);

  let nonce = await provider.getTransactionCount(sender, "pending");

  const report: DailyReport = {
    dateJst: state.dateJst,
    timeJst: state.timeJst,
    chainId: env.TEMPO_CHAIN_ID,
    rpcUrl: env.TEMPO_RPC_URL,
    wallet: sender,
    sink,
    items: []
  };

  const alphaToken = new Contract(TOKENS.alphaUSD, ERC20_ABI, signer);
  const tip403Registry = new Contract(PREDEPLOYED.tip403Registry, TIP403_ABI, signer);
  const feeManager = new Contract(PREDEPLOYED.feeManager, FEE_MANAGER_ABI, signer);

  setStep(state, "feePreference:setUserToken(alphaUSD)");
  {
    const txName = "feePreference:setUserToken(alphaUSD)";
    const overrides = await feeOverrides(provider, nonce);
    const data = feeManager.interface.encodeFunctionData("setUserToken", [TOKENS.alphaUSD]);

    let gasLimit: bigint;
    try {
      gasLimit = await feeManager.setUserToken.estimateGas(TOKENS.alphaUSD, overrides);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} estimateGas`,
          tokenName: "FeeManager",
          tokenAddress: PREDEPLOYED.feeManager,
          to: PREDEPLOYED.feeManager,
          from: sender,
          sink: TOKENS.alphaUSD,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    await assertAlphaFeeBudget(state, alphaToken, sender, gasLimit, overrides, txName);

    let tx;
    try {
      tx = await feeManager.setUserToken(TOKENS.alphaUSD, { ...overrides, gasLimit });
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} send`,
          tokenName: "FeeManager",
          tokenAddress: PREDEPLOYED.feeManager,
          to: PREDEPLOYED.feeManager,
          from: sender,
          sink: TOKENS.alphaUSD,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} waitAndVerify`,
          tokenName: "FeeManager",
          tokenAddress: PREDEPLOYED.feeManager,
          to: PREDEPLOYED.feeManager,
          from: sender,
          sink: TOKENS.alphaUSD,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    const rawReceipt = await fetchRawReceipt(provider, tx.hash);
    report.items.push(makeReportTx(txName, tx.hash, explorerUrl(tx.hash), rawReceipt));
    nonce += 1;
  }

  for (const tokenSpec of TOKEN_LIST) {
    const txName = `transfer:${tokenSpec.name}`;
    setStep(state, txName);

    const token = new Contract(tokenSpec.address, ERC20_ABI, signer);
    await assertTokenDecimals(token, TOKEN_DECIMALS, tokenSpec.name);
    await assertTip20Preflight(
      state,
      token,
      tokenSpec.name,
      tokenSpec.address,
      sender,
      sink,
      "recipient",
      tip403Registry
    );

    const balance = await getTransferBalanceOrThrow(
      state,
      token,
      tokenSpec.name,
      tokenSpec.address,
      sender,
      sink,
      amount
    );

    const overrides = await feeOverrides(provider, nonce);
    const data = token.interface.encodeFunctionData("transfer", [sink, amount]);

    let gasLimit: bigint;
    try {
      gasLimit = await token.transfer.estimateGas(sink, amount, overrides);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} estimateGas`,
          tokenName: tokenSpec.name,
          tokenAddress: tokenSpec.address,
          to: tokenSpec.address,
          from: sender,
          sink,
          amount,
          balance,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    await assertAlphaFeeBudget(state, alphaToken, sender, gasLimit, overrides, txName);

    let tx;
    try {
      tx = await token.transfer(sink, amount, { ...overrides, gasLimit });
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} send`,
          tokenName: tokenSpec.name,
          tokenAddress: tokenSpec.address,
          to: tokenSpec.address,
          from: sender,
          sink,
          amount,
          balance,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} waitAndVerify`,
          tokenName: tokenSpec.name,
          tokenAddress: tokenSpec.address,
          to: tokenSpec.address,
          from: sender,
          sink,
          amount,
          balance,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    const rawReceipt = await fetchRawReceipt(provider, tx.hash);
    report.items.push(makeReportTx(txName, tx.hash, explorerUrl(tx.hash), rawReceipt));
    nonce += 1;
  }

  setStep(state, "approve:AlphaUSD->Permit2(MaxUint256)");
  {
    const txName = "approve:AlphaUSD->Permit2(MaxUint256)";
    await assertTokenDecimals(alphaToken, TOKEN_DECIMALS, "AlphaUSD");
    await assertTip20Preflight(
      state,
      alphaToken,
      "AlphaUSD",
      TOKENS.alphaUSD,
      sender,
      PREDEPLOYED.permit2,
      "spender",
      tip403Registry
    );

    const alphaBalance = BigInt(await alphaToken.balanceOf(sender));
    recordPreflight(state, {
      check: "approveBalanceSnapshot",
      tokenName: "AlphaUSD",
      tokenAddress: TOKENS.alphaUSD,
      wallet: sender,
      balance: alphaBalance.toString()
    });

    const overrides = await feeOverrides(provider, nonce);
    const data = alphaToken.interface.encodeFunctionData("approve", [PREDEPLOYED.permit2, MaxUint256]);

    let gasLimit: bigint;
    try {
      gasLimit = await alphaToken.approve.estimateGas(PREDEPLOYED.permit2, MaxUint256, overrides);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} estimateGas`,
          tokenName: "AlphaUSD",
          tokenAddress: TOKENS.alphaUSD,
          to: TOKENS.alphaUSD,
          from: sender,
          sink: PREDEPLOYED.permit2,
          amount: MaxUint256,
          balance: alphaBalance,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    await assertAlphaFeeBudget(state, alphaToken, sender, gasLimit, overrides, txName);

    let tx;
    try {
      tx = await alphaToken.approve(PREDEPLOYED.permit2, MaxUint256, { ...overrides, gasLimit });
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} send`,
          tokenName: "AlphaUSD",
          tokenAddress: TOKENS.alphaUSD,
          to: TOKENS.alphaUSD,
          from: sender,
          sink: PREDEPLOYED.permit2,
          amount: MaxUint256,
          balance: alphaBalance,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} waitAndVerify`,
          tokenName: "AlphaUSD",
          tokenAddress: TOKENS.alphaUSD,
          to: TOKENS.alphaUSD,
          from: sender,
          sink: PREDEPLOYED.permit2,
          amount: MaxUint256,
          balance: alphaBalance,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    const rawReceipt = await fetchRawReceipt(provider, tx.hash);
    report.items.push(makeReportTx(txName, tx.hash, explorerUrl(tx.hash), rawReceipt));
    nonce += 1;
  }

  setStep(state, "nonTip20:Permit2.approve(AlphaUSD,SINK,MaxUint160,MaxUint48)");
  {
    const txName = "nonTip20:Permit2.approve(AlphaUSD,SINK,MaxUint160,MaxUint48)";
    const permit2 = new Contract(PREDEPLOYED.permit2, PERMIT2_ABI, signer);

    const overrides = await feeOverrides(provider, nonce);
    const data = permit2.interface.encodeFunctionData("approve", [
      TOKENS.alphaUSD,
      sink,
      MAX_UINT160,
      MAX_UINT48
    ]);

    let gasLimit: bigint;
    try {
      gasLimit = await permit2.approve.estimateGas(TOKENS.alphaUSD, sink, MAX_UINT160, MAX_UINT48, overrides);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} estimateGas`,
          tokenName: "Permit2",
          tokenAddress: PREDEPLOYED.permit2,
          to: PREDEPLOYED.permit2,
          from: sender,
          sink,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    await assertAlphaFeeBudget(state, alphaToken, sender, gasLimit, overrides, txName);

    let tx;
    try {
      tx = await permit2.approve(TOKENS.alphaUSD, sink, MAX_UINT160, MAX_UINT48, { ...overrides, gasLimit });
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} send`,
          tokenName: "Permit2",
          tokenAddress: PREDEPLOYED.permit2,
          to: PREDEPLOYED.permit2,
          from: sender,
          sink,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    try {
      await waitAndVerify(tx);
    } catch (error) {
      throwTxFailure(
        {
          action: `${txName} waitAndVerify`,
          tokenName: "Permit2",
          tokenAddress: PREDEPLOYED.permit2,
          to: PREDEPLOYED.permit2,
          from: sender,
          sink,
          nonce,
          data,
          feeFields: overrides
        },
        error
      );
    }

    const rawReceipt = await fetchRawReceipt(provider, tx.hash);
    report.items.push(makeReportTx(txName, tx.hash, explorerUrl(tx.hash), rawReceipt));
    nonce += 1;
  }

  const out = await writeReport(report);
  console.log(`OK: wrote report ${out}`);
  for (const item of report.items) {
    console.log(`${item.name}: ${item.hash} ${item.explorer}`);
    console.log(
      `receiptSummary gasUsed=${item.gasUsed} effectiveGasPrice=${item.effectiveGasPrice} feeToken=${item.feeToken} feePayer=${item.feePayer}`
    );
  }
}

const runState: RunState = {
  dateJst: nowJstDateString(),
  timeJst: nowJstTimeString(),
  chainId: TEMPO.chainId,
  rpcUrl: TEMPO.rpcUrl,
  wallet: null,
  sink: null,
  step: "init",
  preflight: []
};

runDaily(runState).catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FATAL: ${message}`);

  const failureError: FailureReport["error"] =
    error instanceof Error && typeof error.stack === "string"
      ? { message, stack: error.stack }
      : { message };

  const failureReport: FailureReport = {
    ...runState,
    error: failureError
  };

  try {
    const failurePath = await writeFailureReport(failureReport);
    console.error(`FATAL: wrote failure report ${failurePath}`);
  } catch (writeError) {
    console.error(
      `FATAL: failed to write failure report: ${writeError instanceof Error ? writeError.message : String(writeError)}`
    );
  }

  process.exit(1);
});
