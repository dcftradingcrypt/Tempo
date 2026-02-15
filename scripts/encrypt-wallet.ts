import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Wallet } from "ethers";

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  const privateKey = (await rl.question("Private Key (0x...): ")).trim();
  const password = (await rl.question("Password (will not be stored): ")).trim();
  const outPath = (await rl.question("Output path [secrets/wallet.enc]: ")).trim() || "secrets/wallet.enc";

  await rl.close();

  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    throw new Error("Invalid private key format (expected 0x + 64 hex chars)");
  }
  if (!password) throw new Error("Password is required");

  const wallet = new Wallet(privateKey);
  const enc = await wallet.encrypt(password);

  const dir = dirname(outPath);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  await writeFile(outPath, enc, "utf8");
  console.log("OK: encrypted wallet written");
  console.log(`address=${wallet.address}`);
  console.log(`path=${outPath}`);
  console.log("NOTE: do NOT commit password. Commit wallet.enc is allowed (encrypted).");
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
