import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Wallet } from "ethers";

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

async function main(): Promise<void> {
  const privateKey = readRequiredEnv("PRIVATE_KEY");
  const password = readRequiredEnv("WALLET_PASSWORD");
  const outPath = process.env.OUT_PATH?.trim() || "secrets/wallet.enc";

  const wallet = new Wallet(privateKey);
  const encryptedJson = await wallet.encrypt(password);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${encryptedJson}\n`, "utf8");

  console.log(`Encrypted keystore written to ${outPath}`);
  console.log(`Wallet address: ${wallet.address}`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
