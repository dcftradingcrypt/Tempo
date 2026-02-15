import type { JsonRpcProvider, TransactionResponse } from "ethers";
import { EXPLORER_TX_BASE_URL } from "../tempo.js";
import type { RawTransactionReceipt, TxReport } from "./report.js";

type JsonObject = Record<string, unknown>;

function assertObject(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Transaction receipt RPC response must be an object");
  }

  return value as JsonObject;
}

function readHexField(raw: JsonObject, name: string): string {
  const value = raw[name];

  if (typeof value !== "string" || !value.startsWith("0x")) {
    throw new Error(`Receipt field ${name} must be a hex string`);
  }

  return value;
}

export function assertRawTempoReceipt(rawValue: unknown): RawTransactionReceipt {
  const raw = assertObject(rawValue);
  const requiredHexFields = [
    "blockHash",
    "blockNumber",
    "transactionHash",
    "transactionIndex",
    "status",
    "gasUsed",
    "effectiveGasPrice"
  ];

  for (const field of requiredHexFields) {
    readHexField(raw, field);
  }

  const from = raw.from;
  const to = raw.to;
  const feeToken = raw.feeToken;
  const feePayer = raw.feePayer;

  if (typeof from !== "string" || !from.startsWith("0x")) {
    throw new Error("Receipt field from must be a hex address string");
  }

  if (to !== null && (typeof to !== "string" || !to.startsWith("0x"))) {
    throw new Error("Receipt field to must be null or a hex address string");
  }

  if (typeof feeToken !== "string" || !feeToken.startsWith("0x")) {
    throw new Error("Receipt field feeToken must be present as a hex address string");
  }

  if (typeof feePayer !== "string" || !feePayer.startsWith("0x")) {
    throw new Error("Receipt field feePayer must be present as a hex address string");
  }

  return raw as RawTransactionReceipt;
}

function assertReceiptSucceeded(statusHex: string): void {
  const status = Number.parseInt(statusHex, 16);

  if (Number.isNaN(status) || status !== 1) {
    throw new Error(`Transaction status must be 1. actual=${statusHex}`);
  }
}

export class SequentialTxRunner {
  private readonly provider: JsonRpcProvider;
  private nextNonce: number;

  private constructor(provider: JsonRpcProvider, nextNonce: number) {
    this.provider = provider;
    this.nextNonce = nextNonce;
  }

  static async create(
    nonceSource: { getNonce(blockTag?: string): Promise<number> },
    provider: JsonRpcProvider
  ): Promise<SequentialTxRunner> {
    const nonce = await nonceSource.getNonce("pending");

    return new SequentialTxRunner(provider, nonce);
  }

  async sendAndWait(
    id: string,
    sender: (nonce: number) => Promise<TransactionResponse>
  ): Promise<TxReport> {
    const nonce = this.nextNonce;
    const tx = await sender(nonce);

    if (tx.nonce !== nonce) {
      throw new Error(`Nonce mismatch for ${id}. expected=${nonce} actual=${tx.nonce}`);
    }

    const receipt = await tx.wait();

    if (receipt === null) {
      throw new Error(`No receipt returned for ${id}`);
    }

    if (receipt.status !== 1) {
      throw new Error(`Receipt status != 1 for ${id}. hash=${tx.hash}`);
    }

    const rawRpcResult = await this.provider.send("eth_getTransactionReceipt", [tx.hash]);
    const rawReceipt = assertRawTempoReceipt(rawRpcResult);

    assertReceiptSucceeded(rawReceipt.status);

    this.nextNonce += 1;

    return {
      id,
      hash: tx.hash,
      explorerUrl: `${EXPLORER_TX_BASE_URL}/${tx.hash}`,
      gasUsed: rawReceipt.gasUsed,
      effectiveGasPrice: rawReceipt.effectiveGasPrice,
      feeToken: rawReceipt.feeToken,
      feePayer: rawReceipt.feePayer,
      rawReceipt
    };
  }
}
