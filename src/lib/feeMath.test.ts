import { describe, expect, it } from "vitest";
import { attodollarsToMicrodollarsCeil } from "./feeMath.js";

describe("attodollarsToMicrodollarsCeil", () => {
  it("handles boundary values", () => {
    const oneMicroInAtto = 1_000_000_000_000n;

    expect(attodollarsToMicrodollarsCeil(0n)).toBe(0n);
    expect(attodollarsToMicrodollarsCeil(oneMicroInAtto - 1n)).toBe(1n);
    expect(attodollarsToMicrodollarsCeil(oneMicroInAtto)).toBe(1n);
    expect(attodollarsToMicrodollarsCeil(oneMicroInAtto + 1n)).toBe(2n);
  });
});
