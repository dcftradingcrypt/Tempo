import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getJstParts } from "./dateJst.js";

export interface RawTransactionReceipt {
  readonly blockHash: string;
  readonly blockNumber: string;
  readonly from: string;
  readonly to: string | null;
  readonly transactionHash: string;
  readonly transactionIndex: string;
  readonly status: string;
  readonly gasUsed: string;
  readonly effectiveGasPrice: string;
  readonly feeToken: string;
  readonly feePayer: string;
  readonly [key: string]: unknown;
}

export interface TxReport {
  readonly id: string;
  readonly hash: string;
  readonly explorerUrl: string;
  readonly gasUsed: string;
  readonly effectiveGasPrice: string;
  readonly feeToken: string;
  readonly feePayer: string;
  readonly rawReceipt: RawTransactionReceipt;
}

export interface DailyReport {
  readonly dateJst: string;
  readonly runAtJst: string;
  readonly walletAddress: string;
  readonly sinkAddress: string;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly txs: readonly TxReport[];
}

export async function writeDailyReport(
  reportBaseDir: string,
  report: DailyReport,
  now: Date = new Date()
): Promise<string> {
  const jst = getJstParts(now);
  const dayDir = join(reportBaseDir, jst.date);
  const filePath = join(dayDir, `run-${jst.runId}.json`);

  await mkdir(dayDir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return filePath;
}
