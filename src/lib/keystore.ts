import { readFile } from "node:fs/promises";
import { Wallet } from "ethers";

export async function loadWalletFromEnc(encPath: string, password: string): Promise<Wallet> {
  const json = await readFile(encPath, "utf8");
  return await Wallet.fromEncryptedJson(json, password);
}
