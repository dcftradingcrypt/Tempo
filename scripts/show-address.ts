import { loadRuntimeEnv } from "../src/lib/env.js";
import { createTempoProvider } from "../src/lib/provider.js";
import { loadWalletFromKeystore } from "../src/lib/keystore.js";

async function main(): Promise<void> {
  const env = loadRuntimeEnv();
  const provider = await createTempoProvider();
  const wallet = await loadWalletFromKeystore(env.walletEncPath, env.walletPassword, provider);

  console.log(wallet.address);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});
