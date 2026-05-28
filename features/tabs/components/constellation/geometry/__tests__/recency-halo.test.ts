import { recencyHaloMultiplier } from '../recency-halo'

describe('recencyHaloMultiplier', () => {
  it("boosts today's star with the 1.45× multiplier", () => {
    expect(recencyHaloMultiplier(0)).toBe(1.45)
    // Defensive: a negative day count (clock drift, future-dated test
    // data) is treated the same as "today".
    expect(recencyHaloMultiplier(-1)).toBe(1.45)
    expect(recencyHaloMultiplier(-100)).toBe(1.45)
  })

  it('fades linearly 1.0 → 0.55 across days 1..7', () => {
    // day 1 → 1 - (1/7) * 0.45 ≈ 0.9357
    expect(recencyHaloMultiplier(1)).toBeCloseTo(1 - (1 / 7) * 0.45, 6)
    // day 3 → 1 - (3/7) * 0.45 ≈ 0.8071
    expect(recencyHaloMultiplier(3)).toBeCloseTo(1 - (3 / 7) * 0.45, 6)
    // day 7 → 1 - 0.45 = 0.55 (boundary)
    expect(recencyHaloMultiplier(7)).toBeCloseTo(0.55, 6)
  })

  it('fades linearly 0.55 → 0.18 across days 8..21', () => {
    // day 8 → 0.55 - (1/14) * 0.37 ≈ 0.5236
    expect(recencyHaloMultiplier(8)).toBeCloseTo(0.55 - (1 / 14) * 0.37, 6)
    // day 14 → 0.55 - (7/14) * 0.37 = 0.55 - 0.185 = 0.365
    expect(recencyHaloMultiplier(14)).toBeCloseTo(0.365, 6)
    // day 21 → 0.55 - (14/14) * 0.37 = 0.18 (boundary, just hits the floor)
    expect(recencyHaloMultiplier(21)).toBeCloseTo(0.18, 6)
  })

  it('floors at 0.18 past day 21', () => {
    expect(recencyHaloMultiplier(22)).toBe(0.18)
    expect(recencyHaloMultiplier(27)).toBe(0.18)
    expect(recencyHaloMultiplier(1000)).toBe(0.18)
  })
})
