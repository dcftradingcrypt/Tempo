export const TEMPO = {
  chainId: 42431,
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  explorerTxBase: "https://explore.tempo.xyz/tx/"
} as const;

export const TOKENS = {
  pathUSD: "0x20c0000000000000000000000000000000000000",
  alphaUSD: "0x20c0000000000000000000000000000000000001",
  betaUSD: "0x20c0000000000000000000000000000000000002",
  thetaUSD: "0x20c0000000000000000000000000000000000003"
} as const;

export const PREDEPLOYED = {
  permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  feeManager: "0xfeec000000000000000000000000000000000000",
  tip403Registry: "0x403c000000000000000000000000000000000000"
} as const;

export const TOKEN_DECIMALS = 6;
