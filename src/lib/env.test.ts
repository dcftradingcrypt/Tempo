import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("fails without password", () => {
    expect(() => loadEnv({ SINK_ADDRESS: "0x0000000000000000000000000000000000000000" })).toThrow();
  });

  it("checksums sink address", () => {
    const e = loadEnv({
      WALLET_PASSWORD: "x",
      SINK_ADDRESS: "0x0000000000000000000000000000000000000000"
    });
    expect(e.SINK_ADDRESS_CHECKSUM).toBe("0x0000000000000000000000000000000000000000");
  });
});
