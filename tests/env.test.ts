import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRuntimeEnv } from "../src/lib/env.js";

function withEnv(vars: Record<string, string>, fn: () => void): void {
  const oldEnv = { ...process.env };

  process.env = {
    ...oldEnv,
    ...vars
  };

  try {
    fn();
  } finally {
    process.env = oldEnv;
  }
}

describe("loadRuntimeEnv", () => {
  it("fails when required env is missing", () => {
    withEnv({}, () => {
      expect(() => loadRuntimeEnv()).toThrowError("Missing required environment variable: WALLET_PASSWORD");
    });
  });

  it("fails when SINK_ADDRESS is invalid", () => {
    withEnv(
      {
        WALLET_PASSWORD: "x",
        SINK_ADDRESS: "not-an-address"
      },
      () => {
        expect(() => loadRuntimeEnv()).toThrowError("SINK_ADDRESS is not a valid EVM address: not-an-address");
      }
    );
  });

  it("fails when keystore path does not exist", () => {
    withEnv(
      {
        WALLET_PASSWORD: "x",
        SINK_ADDRESS: "0x0000000000000000000000000000000000000001",
        WALLET_ENC_PATH: "secrets/not-found.enc"
      },
      () => {
        expect(() => loadRuntimeEnv()).toThrowError("Encrypted keystore file does not exist: secrets/not-found.enc");
      }
    );
  });

  it("returns parsed and validated values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tempo-env-test-"));
    const encPath = join(dir, "wallet.enc");
    writeFileSync(encPath, "{}\n", "utf8");

    withEnv(
      {
        WALLET_PASSWORD: "pass",
        SINK_ADDRESS: "0x0000000000000000000000000000000000000002",
        WALLET_ENC_PATH: encPath,
        TRANSFER_AMOUNT_WEI: "42"
      },
      () => {
        const env = loadRuntimeEnv();

        expect(env.walletPassword).toBe("pass");
        expect(env.walletEncPath).toBe(encPath);
        expect(env.sinkAddress).toBe("0x0000000000000000000000000000000000000002");
        expect(env.transferAmountWei).toBe(42n);
      }
    );

    rmSync(dir, { recursive: true, force: true });
  });
});
