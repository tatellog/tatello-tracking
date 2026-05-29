import { starRadius } from '../star-radius'

describe('starRadius', () => {
  it('returns the linear curve in the unclamped range', () => {
    // mag 1.5 → 12 - 1.8 = 10.2 (the anchor's headline width)
    expect(starRadius(1.5)).toBeCloseTo(10.2, 6)
    // mag 2.0 → 12 - 2.4 = 9.6
    expect(starRadius(2.0)).toBeCloseTo(9.6, 6)
    // mag 3.5 → 12 - 4.2 = 7.8
    expect(starRadius(3.5)).toBeCloseTo(7.8, 6)
    // mag 3.9 (Rasalas — faint connector) → 12 - 4.68 = 7.32
    expect(starRadius(3.9)).toBeCloseTo(7.32, 6)
  })

  it('clamps the bright end at 11', () => {
    // mag 0 → 12, clamped to 11
    expect(starRadius(0)).toBe(11)
    // mag 0.5 → 11.4, clamped to 11
    expect(starRadius(0.5)).toBe(11)
    // mag -1 → 13.2, clamped to 11
    expect(starRadius(-1)).toBe(11)
  })

  it('clamps the faint end at 4', () => {
    // mag 7 → 12 - 8.4 = 3.6, clamped to 4
    expect(starRadius(7)).toBe(4)
    // mag 10 → 12 - 12 = 0, clamped to 4
    expect(starRadius(10)).toBe(4)
    // mag 100 → very negative, clamped to 4
    expect(starRadius(100)).toBe(4)
  })

  it('returns exactly the boundary value at the edges', () => {
    // r = 11 when mag = 5/6 ≈ 0.8333
    expect(starRadius(5 / 6)).toBe(11)
    // r = 4 when mag = 20/3 ≈ 6.6667
    expect(starRadius(20 / 3)).toBeCloseTo(4, 6)
  })
})
