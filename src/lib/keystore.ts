import { readFile } from "node:fs/promises";
import { Wallet, type HDNodeWallet, type Provider } from "ethers";

export async function loadWalletFromKeystore(
  keystorePath: string,
  password: string,
  provider: Provider
): Promise<Wallet | HDNodeWallet> {
  const keystoreJson = await readFile(keystorePath, "utf8");

  try {
    JSON.parse(keystoreJson);
  } catch {
    throw new Error(`Keystore file is not valid JSON: ${keystorePath}`);
  }

  const wallet = await Wallet.fromEncryptedJson(keystoreJson, password);

  return wallet.connect(provider);
}
