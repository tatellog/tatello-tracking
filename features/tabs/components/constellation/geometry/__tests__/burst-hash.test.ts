import { burstHash } from '../burst-hash'

describe('burstHash', () => {
  it('returns 0 for the (0, 0) seed', () => {
    // sin(0) = 0 → 0 * 43758.5453 = 0 → 0 - floor(0) = 0.
    expect(burstHash(0, 0)).toBe(0)
  })

  it('returns a fractional value in [0, 1) for arbitrary seeds', () => {
    const samples = [
      [1, 0],
      [0, 1],
      [1, 1],
      [3, 7],
      [42, 99],
      [-5, -12],
      [1000, 1000],
    ] as const
    for (const [a, b] of samples) {
      const v = burstHash(a, b)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic for the same (a, b) pair', () => {
    expect(burstHash(7, 11)).toBe(burstHash(7, 11))
    expect(burstHash(-3.5, 2.1)).toBe(burstHash(-3.5, 2.1))
  })

  it('separates similar seeds (no collision on adjacent ids)', () => {
    // The whole point of the hash is to give each spark in a burst a
    // distinct value; adjacent indices must not match.
    expect(burstHash(1, 0)).not.toBe(burstHash(2, 0))
    expect(burstHash(1, 0)).not.toBe(burstHash(1, 1))
    expect(burstHash(0, 1)).not.toBe(burstHash(0, 2))
  })
})
