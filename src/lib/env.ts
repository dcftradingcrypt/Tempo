import { z } from "zod";
import { getAddress } from "ethers";
import { readSecretFile } from "./secretFile.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TIP20_PREFIX = "0x20c000000000000000000000";

const EnvSchema = z.object({
  TEMPO_RPC_URL: z.string().url().default("https://rpc.moderato.tempo.xyz"),
  TEMPO_CHAIN_ID: z.coerce.number().int().default(42431),

  WALLET_ENC_PATH: z.string().min(1).default("secrets/wallet.enc"),
  WALLET_PASSWORD: z.string().min(1),

  SINK_ADDRESS: z.string().min(1),
  TRANSFER_AMOUNT: z.string().min(1).default("1")
});

export type Env = z.infer<typeof EnvSchema>;

function readExclusiveValue(raw: Record<string, unknown>, key: "WALLET_PASSWORD" | "SINK_ADDRESS"): string {
  const valueRaw = raw[key];
  const fileRaw = raw[`${key}_FILE`];

  const value = typeof valueRaw === "string" && valueRaw.length > 0 ? valueRaw : null;
  const filePath = typeof fileRaw === "string" && fileRaw.length > 0 ? fileRaw : null;

  if ((value !== null && filePath !== null) || (value === null && filePath === null)) {
    throw new Error(`${key} and ${key}_FILE are mutually exclusive; set exactly one`);
  }

  if (filePath !== null) {
    return readSecretFile(filePath);
  }

  return value;
}

export function loadEnv(raw: Record<string, unknown>): Env & { SINK_ADDRESS_CHECKSUM: string } {
  const env = EnvSchema.parse({
    ...raw,
    WALLET_PASSWORD: readExclusiveValue(raw, "WALLET_PASSWORD"),
    SINK_ADDRESS: readExclusiveValue(raw, "SINK_ADDRESS")
  });

  const sink = getAddress(env.SINK_ADDRESS);
  const sinkLower = sink.toLowerCase();

  if (sink === ZERO_ADDRESS) {
    throw new Error("SINK_ADDRESS must not be zero address");
  }

  if (sinkLower.startsWith(TIP20_PREFIX)) {
    throw new Error(
      `SINK_ADDRESS must not be TIP-20 namespace target: ${sink}. Use externally owned EVM address.`
    );
  }

  return { ...env, SINK_ADDRESS_CHECKSUM: sink };
}
