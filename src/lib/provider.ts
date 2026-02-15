import { JsonRpcProvider } from "ethers";
import { TEMPO_CHAIN_ID, TEMPO_RPC_URL } from "../tempo.js";

export async function createTempoProvider(): Promise<JsonRpcProvider> {
  const provider = new JsonRpcProvider(TEMPO_RPC_URL, Number(TEMPO_CHAIN_ID));
  const network = await provider.getNetwork();

  if (network.chainId !== TEMPO_CHAIN_ID) {
    throw new Error(
      `Chain ID mismatch. expected=${TEMPO_CHAIN_ID.toString()} actual=${network.chainId.toString()}`
    );
  }

  return provider;
}
