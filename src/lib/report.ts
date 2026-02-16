import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type RawReceipt = Record<string, unknown>;

export type ReportTx = {
  name: string;
  hash: string;
  explorer: string;
  receiptRaw: RawReceipt;
  gasUsed: string;
  effectiveGasPrice: string;
  feeToken: string;
  feePayer: string;
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

export type FailureReport = {
  dateJst: string;
  timeJst: string;
  chainId: number;
  rpcUrl: string;
  wallet: string | null;
  sink: string | null;
  step: string;
  preflight: Record<string, unknown>[];
  error: {
    message: string;
    stack?: string;
  };
};

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, (_key, raw) => (typeof raw === "bigint" ? raw.toString() : raw), 2);
}

function getRequiredString(raw: RawReceipt, key: string, txName: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${txName} receipt missing required field: ${key}`);
  }
  return value;
}

function quantityToDecimal(raw: RawReceipt, key: string, txName: string): string {
  const value = getRequiredString(raw, key, txName);
  try {
    return BigInt(value).toString();
  } catch {
    throw new Error(`${txName} receipt field ${key} is not a valid quantity: ${value}`);
  }
}

export function makeReportTx(
  name: string,
  hash: string,
  explorer: string,
  receiptRaw: RawReceipt
): ReportTx {
  return {
    name,
    hash,
    explorer,
    receiptRaw,
    gasUsed: quantityToDecimal(receiptRaw, "gasUsed", name),
    effectiveGasPrice: quantityToDecimal(receiptRaw, "effectiveGasPrice", name),
    feeToken: getRequiredString(receiptRaw, "feeToken", name),
    feePayer: getRequiredString(receiptRaw, "feePayer", name)
  };
}

export async function writeReport(report: DailyReport): Promise<string> {
  const dir = join("reports", report.dateJst);
  await mkdir(dir, { recursive: true });

  const file = join(dir, `run-${report.timeJst}.json`);
  await writeFile(file, stringifyJson(report), "utf8");
  return file;
}

export async function writeFailureReport(report: FailureReport): Promise<string> {
  const dir = join("reports", report.dateJst);
  await mkdir(dir, { recursive: true });

  const file = join(dir, `run-${report.timeJst}.failure.json`);
  await writeFile(file, stringifyJson(report), "utf8");
  return file;
}
