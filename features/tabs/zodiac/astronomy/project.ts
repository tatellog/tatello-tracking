/**
 * Celestial → viewport projection helpers.
 *
 * The math is intentionally simple — equirectangular with a cos(dec)
 * scale on the x-axis, which is visually faithful for fields up to
 * ~40°. The 12 zodiac constellations all fit comfortably under that.
 *
 * Everything is degree-based at the API boundary so callers don't
 * leak radians into UI code. RA wraps at 360°, handled in
 * `unwrapRightAscension` before any centroid math runs.
 */

const DEG_TO_RAD = Math.PI / 180

export type CelestialStar = {
  /** Hipparcos / IAU short name for traceability. */
  name: string
  /** Right ascension in decimal degrees, J2000. */
  ra: number
  /** Declination in decimal degrees, J2000. */
  dec: number
  /** Apparent visual magnitude (Hipparcos Vmag). */
  mag: number
}

export type Vec2 = { x: number; y: number }

/**
 * Right ascension wraps at 360°. A constellation that straddles the
 * meridian (Pisces does — runs from ~350° through 0° to ~30°) needs
 * its low values pushed by +360 so all stars sit on a single
 * contiguous interval before averaging.
 *
 * Heuristic: if the raw spread exceeds 180° the constellation has
 * wrapped, so add 360 to every value below 180.
 */
export function unwrapRightAscension(ras: readonly number[]): number[] {
  if (ras.length === 0) return []
  const min = Math.min(...ras)
  const max = Math.max(...ras)
  if (max - min <= 180) return [...ras]
  return ras.map((r) => (r < 180 ? r + 360 : r))
}

export function celestialCentroid(stars: readonly CelestialStar[]): { ra: number; dec: number } {
  if (stars.length === 0) return { ra: 0, dec: 0 }
  const ras = unwrapRightAscension(stars.map((s) => s.ra))
  const decs = stars.map((s) => s.dec)
  const ra = ras.reduce((a, b) => a + b, 0) / ras.length
  const dec = decs.reduce((a, b) => a + b, 0) / decs.length
  return { ra: ((ra % 360) + 360) % 360, dec }
}

/**
 * Project a star to a plane tangent to the celestial sphere at
 * (ra0, dec0). Equirectangular with cos(dec0) on x — sufficient for
 * the modest fields the zodiac spans.
 *
 * The y-axis is inverted (higher Dec = lower y) so the result reads
 * "north is up" once pasted into an SVG with the usual y-down origin.
 */
export function projectEquirectangular(
  star: CelestialStar,
  ra0: number,
  dec0: number,
  raWrapped?: number,
): Vec2 {
  const ra = raWrapped ?? star.ra
  const cosDec0 = Math.cos(dec0 * DEG_TO_RAD)
  return {
    x: (ra - ra0) * cosDec0,
    y: -(star.dec - dec0),
  }
}

export type BoundingBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundingBox(points: readonly Vec2[]): BoundingBox {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export type FitOptions = {
  /** Fractional padding [0..0.5] of the target unit square. */
  padding: number
  /**
   * Centroid offset away from (0.5, 0.5) so the day-counter inside
   * LunarConstellation stays unobstructed. Positive `cy` pushes the
   * pattern toward the top of the canvas.
   */
  centerOffsetX: number
  centerOffsetY: number
}

/**
 * Fit projected points to the unit square [0..1] preserving the
 * constellation's aspect ratio, then translate so the centroid lands
 * at (0.5 + dx, 0.5 + dy). Returns points in [0..1] coords ready to
 * multiply by the SVG viewport dimensions.
 */
export function fitToUnitSquare(
  points: readonly Vec2[],
  opts: FitOptions,
): { points: Vec2[]; centroid: Vec2 } {
  if (points.length === 0) {
    return { points: [], centroid: { x: 0.5, y: 0.5 } }
  }
  const bbox = boundingBox(points)
  const w = Math.max(bbox.maxX - bbox.minX, 1e-9)
  const h = Math.max(bbox.maxY - bbox.minY, 1e-9)
  const usable = 1 - 2 * opts.padding
  const scale = Math.min(usable / w, usable / h)

  // Scale around the bbox's centre so the constellation is centred
  // before we translate it.
  const bboxCx = (bbox.minX + bbox.maxX) / 2
  const bboxCy = (bbox.minY + bbox.maxY) / 2

  const targetCx = 0.5 + opts.centerOffsetX
  const targetCy = 0.5 + opts.centerOffsetY

  const projected = points.map((p) => ({
    x: targetCx + (p.x - bboxCx) * scale,
    y: targetCy + (p.y - bboxCy) * scale,
  }))

  return { points: projected, centroid: { x: targetCx, y: targetCy } }
}

/**
 * Magnitude → render radius. Hipparcos magnitudes span roughly -1 to
 * +6 for naked-eye stars; we render them in [2 px .. 5.5 px]. Linear
 * mapping looks fine at the densities the zodiac patterns use — a
 * fully perceptual (logarithmic) scale crushes faint stars below the
 * sub-pixel threshold.
 */
export function magnitudeToRadius(mag: number): number {
  const r = 5.5 - 0.7 * mag
  if (r < 1.6) return 1.6
  if (r > 5.5) return 5.5
  return r
}
