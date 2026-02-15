import { existsSync } from "node:fs";
import { getAddress, isAddress } from "ethers";

export interface RuntimeEnv {
  readonly walletPassword: string;
  readonly walletEncPath: string;
  readonly sinkAddress: string;
  readonly reportBaseDir: string;
  readonly transferAmountWei: bigint;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function parsePositiveBigInt(name: string, value: string): bigint {
  let parsed: bigint;

  try {
    parsed = BigInt(value);
  } catch {
    throw new Error(`${name} must be a base-10 integer string: received ${value}`);
  }

  if (parsed <= 0n) {
    throw new Error(`${name} must be > 0: received ${value}`);
  }

  return parsed;
}

export function loadRuntimeEnv(): RuntimeEnv {
  const walletPassword = readRequiredEnv("WALLET_PASSWORD");
  const sinkAddressRaw = readRequiredEnv("SINK_ADDRESS");

  if (!isAddress(sinkAddressRaw)) {
    throw new Error(`SINK_ADDRESS is not a valid EVM address: ${sinkAddressRaw}`);
  }

  const walletEncPath = process.env.WALLET_ENC_PATH?.trim() || "secrets/wallet.enc";

  if (!existsSync(walletEncPath)) {
    throw new Error(`Encrypted keystore file does not exist: ${walletEncPath}`);
  }

  const reportBaseDir = process.env.REPORT_BASE_DIR?.trim() || "reports";
  const transferAmountRaw = process.env.TRANSFER_AMOUNT_WEI?.trim() || "1";
  const transferAmountWei = parsePositiveBigInt("TRANSFER_AMOUNT_WEI", transferAmountRaw);

  return {
    walletPassword,
    walletEncPath,
    sinkAddress: getAddress(sinkAddressRaw),
    reportBaseDir,
    transferAmountWei
  };
}
