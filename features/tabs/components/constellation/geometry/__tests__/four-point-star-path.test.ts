import { STAR_INNER_RATIO, fourPointStarPath } from '../four-point-star-path'

describe('fourPointStarPath', () => {
  it('keeps STAR_INNER_RATIO at the calibrated 0.32', () => {
    // Lower values → sharper rays; this value was tuned against the
    // reference asterism so the polygon doesn't read as a crucifix.
    // Any change here is a visual change — not a refactor cleanup.
    expect(STAR_INNER_RATIO).toBe(0.32)
  })

  it('returns a closed SVG path with 8 vertices', () => {
    const d = fourPointStarPath(0, 0, 10)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    // 8 vertices → 7 'L' separators between them.
    expect(d.match(/L/g)?.length).toBe(7)
  })

  it("opens at the top vertex (12 o'clock)", () => {
    // Centred at (50, 50) with outer=10 → first point sits directly
    // above the centre at (50.00, 40.00).
    const d = fourPointStarPath(50, 50, 10)
    expect(d.startsWith('M50.00,40.00')).toBe(true)
  })

  it('alternates outer and inner vertices', () => {
    // Centred at origin so we can read the path coordinates directly.
    const d = fourPointStarPath(0, 0, 10)
    // Point at index 2 (i=2, angle=0) sits on the +x axis at outer
    // radius → x=10, y=0.
    expect(d).toContain('L10.00,0.00')
    // Point at index 1 (i=1, angle=-π/4) sits in the upper-right at
    // inner radius (3.2 × √2/2 ≈ 2.26) → x≈2.26, y≈-2.26.
    expect(d).toContain('L2.26,-2.26')
  })

  it('scales the inner radius by STAR_INNER_RATIO', () => {
    // outer=100, inner=32 → the rightmost outer point is at x=100,
    // the upper-right inner point is at x≈100*0.32*cos(-π/4) ≈ 22.63.
    const d = fourPointStarPath(0, 0, 100)
    expect(d).toContain('L100.00,0.00')
    expect(d).toContain('L22.63,-22.63')
  })
})
