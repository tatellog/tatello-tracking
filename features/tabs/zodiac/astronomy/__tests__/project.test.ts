import {
  boundingBox,
  celestialCentroid,
  fitToUnitSquare,
  magnitudeToRadius,
  projectEquirectangular,
  unwrapRightAscension,
  type CelestialStar,
} from '../project'

describe('unwrapRightAscension', () => {
  it('returns input untouched when no wrap', () => {
    expect(unwrapRightAscension([10, 20, 30])).toEqual([10, 20, 30])
    expect(unwrapRightAscension([170, 180, 200])).toEqual([170, 180, 200])
  })

  it('detects wrap and shifts low values by +360', () => {
    expect(unwrapRightAscension([350, 5, 20])).toEqual([350, 365, 380])
    expect(unwrapRightAscension([349, 30])).toEqual([349, 390])
  })

  it('handles empty input', () => {
    expect(unwrapRightAscension([])).toEqual([])
  })
})

describe('celestialCentroid', () => {
  const star = (ra: number, dec: number): CelestialStar => ({ name: 't', ra, dec, mag: 3 })

  it('averages simple coords', () => {
    const c = celestialCentroid([star(0, 0), star(20, 10)])
    expect(c.ra).toBeCloseTo(10)
    expect(c.dec).toBeCloseTo(5)
  })

  it('handles meridian wrap (Piscis-like)', () => {
    const c = celestialCentroid([star(349.3, 3), star(22.9, 15)])
    // 349.3 + (22.9 + 360) = 372.2, /2 = 186.1, mod 360 = 186.1?
    // Actually (349.3 + 382.9) / 2 = 366.1, mod 360 = 6.1
    expect(c.ra).toBeCloseTo(6.1, 1)
    expect(c.dec).toBeCloseTo(9)
  })
})

describe('projectEquirectangular', () => {
  const star = (ra: number, dec: number): CelestialStar => ({ name: 't', ra, dec, mag: 3 })

  it('projects (ra0, dec0) to origin', () => {
    const p = projectEquirectangular(star(30, 10), 30, 10)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('inverts y (higher dec → lower y, so north is up)', () => {
    const p = projectEquirectangular(star(30, 15), 30, 10)
    expect(p.y).toBe(-5)
  })

  it('respects raWrapped override', () => {
    const p = projectEquirectangular(star(10, 0), 350, 0, 370)
    // With raWrapped=370 vs ra0=350: dx = 20, cos(0) = 1
    expect(p.x).toBeCloseTo(20)
  })
})

describe('boundingBox', () => {
  it('returns sane defaults for empty', () => {
    expect(boundingBox([])).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 })
  })

  it('finds extrema', () => {
    expect(
      boundingBox([
        { x: -1, y: 2 },
        { x: 3, y: -4 },
        { x: 0, y: 0 },
      ]),
    ).toEqual({ minX: -1, minY: -4, maxX: 3, maxY: 2 })
  })
})

describe('fitToUnitSquare', () => {
  it('places centroid at the requested offset', () => {
    const { centroid } = fitToUnitSquare(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      { padding: 0.1, centerOffsetX: -0.04, centerOffsetY: -0.08 },
    )
    expect(centroid.x).toBeCloseTo(0.46)
    expect(centroid.y).toBeCloseTo(0.42)
  })

  it('respects padding — points sit within [padding, 1 - padding] for a square pattern', () => {
    const { points } = fitToUnitSquare(
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ],
      { padding: 0.1, centerOffsetX: 0, centerOffsetY: 0 },
    )
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0.1 - 1e-6)
      expect(p.x).toBeLessThanOrEqual(0.9 + 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(0.1 - 1e-6)
      expect(p.y).toBeLessThanOrEqual(0.9 + 1e-6)
    }
  })

  it('preserves aspect ratio (wide constellations stay wide)', () => {
    // 20 wide × 5 tall — after fit, x-spread should be 4× y-spread.
    const { points } = fitToUnitSquare(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 5 },
        { x: 0, y: 5 },
      ],
      { padding: 0, centerOffsetX: 0, centerOffsetY: 0 },
    )
    const bb = boundingBox(points)
    const w = bb.maxX - bb.minX
    const h = bb.maxY - bb.minY
    expect(w / h).toBeCloseTo(4, 5)
  })
})

describe('magnitudeToRadius', () => {
  it('is monotonically non-increasing in magnitude', () => {
    const samples = [-1, 0, 1, 2, 3, 4, 5, 6]
    const radii = samples.map(magnitudeToRadius)
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeLessThanOrEqual(radii[i - 1]!)
    }
  })

  it('clamps to a visible floor', () => {
    expect(magnitudeToRadius(6)).toBeGreaterThanOrEqual(1.6)
    expect(magnitudeToRadius(10)).toBeGreaterThanOrEqual(1.6)
  })

  it('clamps to a max ceiling', () => {
    expect(magnitudeToRadius(-2)).toBeLessThanOrEqual(5.5)
    expect(magnitudeToRadius(-10)).toBeLessThanOrEqual(5.5)
  })
})
