import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeDailyReport, type DailyReport } from "../src/lib/report.js";

const sampleReport: DailyReport = {
  dateJst: "2026-02-15",
  runAtJst: "2026-02-15T09:00:00+09:00",
  walletAddress: "0x0000000000000000000000000000000000000011",
  sinkAddress: "0x0000000000000000000000000000000000000022",
  chainId: 42431,
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  txs: [
    {
      id: "pathUSD.transfer",
      hash: "0xhash",
      explorerUrl: "https://explore.tempo.xyz/tx/0xhash",
      gasUsed: "0x5208",
      effectiveGasPrice: "0x1",
      feeToken: "0x0000000000000000000000000000000000000003",
      feePayer: "0x0000000000000000000000000000000000000004",
      rawReceipt: {
        blockHash: "0x1",
        blockNumber: "0x2",
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        transactionHash: "0xhash",
        transactionIndex: "0x0",
        status: "0x1",
        gasUsed: "0x5208",
        effectiveGasPrice: "0x1",
        feeToken: "0x0000000000000000000000000000000000000003",
        feePayer: "0x0000000000000000000000000000000000000004"
      }
    }
  ]
};

describe("writeDailyReport", () => {
  it("writes expected json structure under reports/YYYY-MM-DD", async () => {
    const reportBase = mkdtempSync(join(tmpdir(), "tempo-report-test-"));
    const fixedNow = new Date("2026-02-15T00:34:56.000Z");

    const path = await writeDailyReport(reportBase, sampleReport, fixedNow);
    expect(path).toMatch(/\/2026-02-15\/run-093456\.json$/);

    const parsed = JSON.parse(readFileSync(path, "utf8")) as DailyReport;

    expect(parsed.chainId).toBe(42431);
    expect(parsed.rpcUrl).toBe("https://rpc.moderato.tempo.xyz");
    expect(parsed.txs[0]?.hash).toBe("0xhash");
    expect(parsed.txs[0]?.rawReceipt.feeToken).toBe("0x0000000000000000000000000000000000000003");

    rmSync(reportBase, { recursive: true, force: true });
  });
});
