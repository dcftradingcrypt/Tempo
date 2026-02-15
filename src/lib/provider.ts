import { JsonRpcProvider } from "ethers";

export function makeProvider(rpcUrl: string, chainId: number): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl, { name: "tempo-moderato", chainId });
}

export async function assertChainId(provider: JsonRpcProvider, expectedChainId: number): Promise<void> {
  const net = await provider.getNetwork();
  const actual = Number(net.chainId);
  if (actual !== expectedChainId) {
    throw new Error(`chainId mismatch: expected=${expectedChainId} actual=${actual}`);
  }
}
