import { describe, expect, it } from "vitest";
import { makeReportTx } from "./report.js";

describe("makeReportTx", () => {
  it("extracts fee fields and converts quantities to decimal strings", () => {
    const tx = makeReportTx("transfer:pathUSD", "0xabc", "https://explore.tempo.xyz/tx/0xabc", {
      gasUsed: "0x5208",
      effectiveGasPrice: "0x3b9aca00",
      feeToken: "0x20c0000000000000000000000000000000000001",
      feePayer: "0x0000000000000000000000000000000000000011"
    });

    expect(tx.gasUsed).toBe("21000");
    expect(tx.effectiveGasPrice).toBe("1000000000");
    expect(tx.feeToken).toBe("0x20c0000000000000000000000000000000000001");
    expect(tx.feePayer).toBe("0x0000000000000000000000000000000000000011");
  });

  it("throws if feeToken is missing", () => {
    expect(() =>
      makeReportTx("transfer:pathUSD", "0xabc", "https://explore.tempo.xyz/tx/0xabc", {
        gasUsed: "0x5208",
        effectiveGasPrice: "0x3b9aca00",
        feePayer: "0x0000000000000000000000000000000000000011"
      })
    ).toThrow("receipt missing required field: feeToken");
  });
});
