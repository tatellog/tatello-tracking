/*
 * Deterministic 0..1 hash — gives per-(burst, spark) variation
 * without a real RNG, so a given burst is reproducible but no two
 * are alike.
 */
export function burstHash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}
