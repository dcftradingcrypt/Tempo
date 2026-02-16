export const ATTO_PER_MICRODOLLAR = 1_000_000_000_000n;

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error(`denominator must be > 0, got ${denominator.toString()}`);
  if (numerator < 0n) throw new Error(`numerator must be >= 0, got ${numerator.toString()}`);
  if (numerator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

export function attodollarsToMicrodollarsCeil(attodollars: bigint): bigint {
  return ceilDiv(attodollars, ATTO_PER_MICRODOLLAR);
}
