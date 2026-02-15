import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("fails without password", () => {
    expect(() => loadEnv({ SINK_ADDRESS: "0x0000000000000000000000000000000000000000" })).toThrow();
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
        SINK_ADDRESS: "0x20c0000000000000000000000000000000000123"
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
