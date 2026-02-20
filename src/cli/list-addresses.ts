import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getAddress } from "ethers";

type AddressEntry = {
  index: number;
  address: string;
};

function normalizeAddress(raw: string): string {
  const candidate = raw.startsWith("0x") ? raw : `0x${raw}`;
  return getAddress(candidate);
}

function extractAddress(value: unknown, index: number): string {
  if (typeof value === "string") {
    return normalizeAddress(value);
  }

  if (value !== null && typeof value === "object") {
    const address = (value as Record<string, unknown>).address;
    if (typeof address === "string" && address.length > 0) {
      return normalizeAddress(address);
    }
  }

  throw new Error(`wallet entry at index ${index} has no usable address`);
}

async function main(): Promise<void> {
  const encPath = process.env.WALLET_ENC_PATH || "secrets/wallet.enc";
  const args = new Set(process.argv.slice(2));
  const jsonText = await readFile(encPath, "utf8");
  const parsed = JSON.parse(jsonText) as unknown;
  const values = Array.isArray(parsed) ? parsed : [parsed];

  const entries: AddressEntry[] = values.map((value, index) => ({
    index,
    address: extractAddress(value, index)
  }));

  if (args.has("--json")) {
    process.stdout.write(`${JSON.stringify(entries)}\n`);
    return;
  }

  for (const entry of entries) {
    console.log(`${entry.index}: ${entry.address}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
