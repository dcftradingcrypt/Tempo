import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type ReportTx = {
  name: string;
  hash: string;
  explorer: string;
  receipt: Record<string, unknown>;
};

export type DailyReport = {
  dateJst: string;
  timeJst: string;
  chainId: number;
  rpcUrl: string;
  wallet: string;
  sink: string;
  items: ReportTx[];
};

export async function writeReport(report: DailyReport): Promise<string> {
  const dir = join("reports", report.dateJst);
  await mkdir(dir, { recursive: true });

  const file = join(dir, `run-${report.timeJst}.json`);
  await writeFile(file, JSON.stringify(report, null, 2), "utf8");
  return file;
}
