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

  it("checksums sink address", () => {
    const e = loadEnv({
      WALLET_PASSWORD: "x",
      SINK_ADDRESS: "0x0000000000000000000000000000000000000001"
    });
    expect(e.SINK_ADDRESS_CHECKSUM).toBe("0x0000000000000000000000000000000000000001");
  });
});
