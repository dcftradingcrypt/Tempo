import { describe, expect, it } from "vitest";
import { assertRawTempoReceipt } from "../src/lib/tx.js";

describe("assertRawTempoReceipt", () => {
  it("accepts receipt that includes feeToken and feePayer", () => {
    const receipt = assertRawTempoReceipt({
      blockHash: "0x01",
      blockNumber: "0x02",
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      transactionHash: "0x03",
      transactionIndex: "0x0",
      status: "0x1",
      gasUsed: "0x5208",
      effectiveGasPrice: "0x5",
      feeToken: "0x0000000000000000000000000000000000000003",
      feePayer: "0x0000000000000000000000000000000000000004"
    });

    expect(receipt.status).toBe("0x1");
  });

  it("fails when feeToken is missing", () => {
    expect(() =>
      assertRawTempoReceipt({
        blockHash: "0x01",
        blockNumber: "0x02",
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        transactionHash: "0x03",
        transactionIndex: "0x0",
        status: "0x1",
        gasUsed: "0x5208",
        effectiveGasPrice: "0x5",
        feePayer: "0x0000000000000000000000000000000000000004"
      })
    ).toThrowError("Receipt field feeToken must be present as a hex address string");
  });
});
