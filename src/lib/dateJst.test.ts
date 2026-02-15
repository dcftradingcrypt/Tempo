import { describe, expect, it } from "vitest";
import { nowJstDateString } from "./dateJst.js";

describe("nowJstDateString", () => {
  it("returns YYYY-MM-DD", () => {
    const s = nowJstDateString();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
