import { Contract, MaxUint256, type TransactionResponse } from "ethers";
import { ERC20_ABI } from "./abi/erc20.js";
import { PERMIT2_ABI } from "./abi/permit2.js";
import { loadRuntimeEnv } from "./lib/env.js";
import { loadWalletFromKeystore } from "./lib/keystore.js";
import { createTempoProvider } from "./lib/provider.js";
import { writeDailyReport, type DailyReport, type TxReport } from "./lib/report.js";
import { SequentialTxRunner } from "./lib/tx.js";
import { getJstParts } from "./lib/dateJst.js";
import { PERMIT2_ADDRESS, TEMPO_CHAIN_ID, TEMPO_RPC_URL, TOKENS } from "./tempo.js";

const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT48 = (1n << 48n) - 1n;

interface Erc20Writer {
  transfer(to: string, value: bigint, overrides: { nonce: number }): Promise<TransactionResponse>;
  approve(spender: string, value: bigint, overrides: { nonce: number }): Promise<TransactionResponse>;
}

interface Permit2Writer {
  approve(
    token: string,
    spender: string,
    amount: bigint,
    expiration: bigint,
    overrides: { nonce: number }
  ): Promise<TransactionResponse>;
}

async function runDailyActivity(): Promise<string> {
  const env = loadRuntimeEnv();
  const provider = await createTempoProvider();
  const wallet = await loadWalletFromKeystore(env.walletEncPath, env.walletPassword, provider);

  const pathToken = new Contract(TOKENS.pathUSD, ERC20_ABI, wallet) as unknown as Erc20Writer;
  const alphaToken = new Contract(TOKENS.AlphaUSD, ERC20_ABI, wallet) as unknown as Erc20Writer;
  const betaToken = new Contract(TOKENS.BetaUSD, ERC20_ABI, wallet) as unknown as Erc20Writer;
  const thetaToken = new Contract(TOKENS.ThetaUSD, ERC20_ABI, wallet) as unknown as Erc20Writer;
  const permit2 = new Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet) as unknown as Permit2Writer;

  const txRunner = await SequentialTxRunner.create(wallet, provider);
  const txs: TxReport[] = [];

  txs.push(
    await txRunner.sendAndWait("pathUSD.transfer", (nonce) =>
      pathToken.transfer(env.sinkAddress, env.transferAmountWei, { nonce })
    )
  );

  txs.push(
    await txRunner.sendAndWait("AlphaUSD.transfer", (nonce) =>
      alphaToken.transfer(env.sinkAddress, env.transferAmountWei, { nonce })
    )
  );

  txs.push(
    await txRunner.sendAndWait("BetaUSD.transfer", (nonce) =>
      betaToken.transfer(env.sinkAddress, env.transferAmountWei, { nonce })
    )
  );

  txs.push(
    await txRunner.sendAndWait("ThetaUSD.transfer", (nonce) =>
      thetaToken.transfer(env.sinkAddress, env.transferAmountWei, { nonce })
    )
  );

  txs.push(
    await txRunner.sendAndWait("AlphaUSD.approve(Permit2, MaxUint256)", (nonce) =>
      alphaToken.approve(PERMIT2_ADDRESS, MaxUint256, { nonce })
    )
  );

  txs.push(
    await txRunner.sendAndWait("Permit2.approve(AlphaUSD, SINK, MaxUint160, MaxUint48)", (nonce) =>
      permit2.approve(TOKENS.AlphaUSD, env.sinkAddress, MAX_UINT160, MAX_UINT48, { nonce })
    )
  );

  const jst = getJstParts();
  const report: DailyReport = {
    dateJst: jst.date,
    runAtJst: jst.timestamp,
    walletAddress: wallet.address,
    sinkAddress: env.sinkAddress,
    chainId: Number(TEMPO_CHAIN_ID),
    rpcUrl: TEMPO_RPC_URL,
    txs
  };

  return writeDailyReport(env.reportBaseDir, report);
}

runDailyActivity()
  .then((reportPath) => {
    console.log(`[daily] success report=${reportPath}`);
  })
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(`[daily] failed: ${error.message}`);
      console.error(error.stack);
    } else {
      console.error("[daily] failed with non-error value");
      console.error(error);
    }

    process.exit(1);
  });
