import { z } from "zod";
import { getAddress } from "ethers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const EnvSchema = z.object({
  TEMPO_RPC_URL: z.string().url().default("https://rpc.moderato.tempo.xyz"),
  TEMPO_CHAIN_ID: z.coerce.number().int().default(42431),

  WALLET_ENC_PATH: z.string().min(1).default("secrets/wallet.enc"),
  WALLET_PASSWORD: z.string().min(1),

  SINK_ADDRESS: z.string().min(1),
  TRANSFER_AMOUNT: z.string().min(1).default("1")
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(raw: Record<string, unknown>): Env & { SINK_ADDRESS_CHECKSUM: string } {
  const env = EnvSchema.parse(raw);

  const sink = getAddress(env.SINK_ADDRESS);

  if (sink === ZERO_ADDRESS) {
    throw new Error("SINK_ADDRESS must not be zero address");
  }

  return { ...env, SINK_ADDRESS_CHECKSUM: sink };
}
