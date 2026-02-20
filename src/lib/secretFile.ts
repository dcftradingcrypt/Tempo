import { readFileSync } from "node:fs";

export function readSecretFile(path: string): string {
  const buffer = readFileSync(path);
  let text = buffer.toString("utf8");

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  return text.replace(/\r?\n$/, "");
}
