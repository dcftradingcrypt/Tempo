import "dotenv/config";
import { Wallet } from "ethers";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const encPath = process.env.WALLET_ENC_PATH || "secrets/wallet.enc";
  const password = process.env.WALLET_PASSWORD;
  if (!password) throw new Error("WALLET_PASSWORD is required");

  const json = await readFile(encPath, "utf8");
  const w = await Wallet.fromEncryptedJson(json, password);
  console.log(`address=${w.address}`);
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
