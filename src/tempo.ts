import { getAddress } from "ethers";

export const TEMPO_RPC_URL = "https://rpc.moderato.tempo.xyz";
export const TEMPO_CHAIN_ID = 42431n;
export const EXPLORER_TX_BASE_URL = "https://explore.tempo.xyz/tx";

export const PERMIT2_ADDRESS = getAddress("0x000000000022d473030f116ddee9f6b43ac78ba3");

export const TOKENS = {
  pathUSD: getAddress("0x4a0d1092e9df255cf95d72834ea9255132782318"),
  AlphaUSD: getAddress("0x8a900d1d24ed6046ecea37677000e112d47fa58c"),
  BetaUSD: getAddress("0xc5a5b43180192c3ba6e5e360dc7e8d5ed6921f55"),
  ThetaUSD: getAddress("0xb0f7858f5c8c6fc6656c6b317c80813df9ec5ae9")
} as const;

export type TokenSymbol = keyof typeof TOKENS;
