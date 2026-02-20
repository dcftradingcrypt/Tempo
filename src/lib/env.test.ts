import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadEnv", () => {
  it("fails without password", () => {
    expect(() => loadEnv({ SINK_ADDRESS: "0x0000000000000000000000000000000000000000" })).toThrow();
  });

  it("fails when both WALLET_PASSWORD and WALLET_PASSWORD_FILE are set", () => {
    expect(() =>
      loadEnv({
        WALLET_PASSWORD: "x",
        WALLET_PASSWORD_FILE: "secrets/pw.txt",
        SINK_ADDRESS: "0x0000000000000000000000000000000000000001"
      })
    ).toThrow("WALLET_PASSWORD and WALLET_PASSWORD_FILE are mutually exclusive");
  });

  it("fails when both SINK_ADDRESS and SINK_ADDRESS_FILE are set", () => {
    expect(() =>
      loadEnv({
        WALLET_PASSWORD: "x",
        SINK_ADDRESS: "0x0000000000000000000000000000000000000001",
        SINK_ADDRESS_FILE: "secrets/sink.txt"
      })
    ).toThrow("SINK_ADDRESS and SINK_ADDRESS_FILE are mutually exclusive");
  });

  it("loads password/sink from *_FILE", () => {
    const dir = mkdtempSync(join(tmpdir(), "tempo-env-test-"));

    try {
      const pwFile = join(dir, "pw.txt");
      const sinkFile = join(dir, "sink.txt");

      writeFileSync(pwFile, Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from("file-pass\n", "utf8")]));
      writeFileSync(sinkFile, "0x0000000000000000000000000000000000000001\n", "utf8");

      const e = loadEnv({
        WALLET_PASSWORD_FILE: pwFile,
        SINK_ADDRESS_FILE: sinkFile
      });

      expect(e.WALLET_PASSWORD).toBe("file-pass");
      expect(e.SINK_ADDRESS_CHECKSUM).toBe("0x0000000000000000000000000000000000000001");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects zero address sink", () => {
    expect(() =>
      loadEnv({
        WALLET_PASSWORD: "x",
        SINK_ADDRESS: "0x0000000000000000000000000000000000000000"
      })
    ).toThrow("SINK_ADDRESS must not be zero address");
  });

  it("rejects tip20 prefix sink", () => {
    expect(() =>
      loadEnv({
        WALLET_PASSWORD: "x",
        SINK_ADDRESS: "0x20c0000000000000000000000000000000000000"
      })
    ).toThrow("SINK_ADDRESS must not be TIP-20 namespace target");
  });

  it("checksums sink address", () => {
    const e = loadEnv({
      WALLET_PASSWORD: "x",
      SINK_ADDRESS: "0x0000000000000000000000000000000000000001"
    });
    expect(e.SINK_ADDRESS_CHECKSUM).toBe("0x0000000000000000000000000000000000000001");
  });
});
