import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readSecretFile } from "./secretFile.js";

describe("readSecretFile", () => {
  it("strips UTF-8 BOM and one trailing newline", () => {
    const dir = mkdtempSync(join(tmpdir(), "tempo-secret-test-"));

    try {
      const path = join(dir, "secret.txt");
      const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("abc123\n", "utf8")]);
      writeFileSync(path, bytes);
      expect(readSecretFile(path)).toBe("abc123");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("strips CRLF trailing newline", () => {
    const dir = mkdtempSync(join(tmpdir(), "tempo-secret-test-"));

    try {
      const path = join(dir, "secret.txt");
      writeFileSync(path, "abc123\r\n", "utf8");
      expect(readSecretFile(path)).toBe("abc123");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps value without trailing newline unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "tempo-secret-test-"));

    try {
      const path = join(dir, "secret.txt");
      writeFileSync(path, "abc123", "utf8");
      expect(readSecretFile(path)).toBe("abc123");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
