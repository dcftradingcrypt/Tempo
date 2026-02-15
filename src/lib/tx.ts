import type { JsonRpcProvider, ContractTransactionResponse, TransactionReceipt } from "ethers";

export type RawReceipt = Record<string, unknown>;

export async function feeOverrides(provider: JsonRpcProvider, nonce: number): Promise<Record<string, unknown>> {
  const fee = await provider.getFeeData();

  if (fee.maxFeePerGas != null && fee.maxPriorityFeePerGas != null) {
    return {
      nonce,
      type: 2,
      maxFeePerGas: fee.maxFeePerGas,
      maxPriorityFeePerGas: fee.maxPriorityFeePerGas
    };
  }

  if (fee.gasPrice != null) {
    return { nonce, gasPrice: fee.gasPrice };
  }

  throw new Error("provider.getFeeData() returned no usable fee fields");
}

export async function waitAndVerify(tx: ContractTransactionResponse): Promise<TransactionReceipt> {
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`Missing receipt for tx=${tx.hash}`);
  if (receipt.status !== 1) throw new Error(`Tx failed (status=${receipt.status}) tx=${tx.hash}`);
  return receipt;
}

export async function fetchRawReceipt(provider: JsonRpcProvider, txHash: string): Promise<RawReceipt> {
  const raw = await provider.send("eth_getTransactionReceipt", [txHash]);
  if (!raw) throw new Error(`eth_getTransactionReceipt returned null for tx=${txHash}`);
  return raw as RawReceipt;
}
