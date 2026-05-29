import { AMBIENT_BUCKET_COUNT, AMBIENT_STAR_COUNT } from '../../constants'
import { DEEP_STARS, buildAmbientField } from '../scatter'

describe('buildAmbientField', () => {
  it('returns AMBIENT_BUCKET_COUNT buckets', () => {
    expect(buildAmbientField()).toHaveLength(AMBIENT_BUCKET_COUNT)
  })

  it('skips stars that fall on the centre chip', () => {
    // Total < raw count because the centre exclusion filter drops
    // any seed that lands inside the chip's rough footprint.
    const total = buildAmbientField().reduce((acc, b) => acc + b.length, 0)
    expect(total).toBeLessThan(AMBIENT_STAR_COUNT)
    // Belt + braces: more than half the seeds survive. If this
    // dropped to single digits we'd know the centre filter or the
    // seed math drifted.
    expect(total).toBeGreaterThan(AMBIENT_STAR_COUNT / 2)
  })

  it('returns identical buckets across calls (deterministic)', () => {
    expect(buildAmbientField()).toEqual(buildAmbientField())
  })

  it('every star matches the AmbientStar shape', () => {
    for (const bucket of buildAmbientField()) {
      for (const star of bucket) {
        expect(typeof star.x).toBe('number')
        expect(typeof star.y).toBe('number')
        expect(typeof star.r).toBe('number')
        expect(typeof star.baseOp).toBe('number')
        expect(typeof star.sparkle).toBe('boolean')
      }
    }
  })
})

describe('DEEP_STARS', () => {
  it('has more than half the seeds surviving the centre filter', () => {
    // 30 seeds in the IIFE; the centre exclusion drops some.
    expect(DEEP_STARS.length).toBeGreaterThan(15)
    expect(DEEP_STARS.length).toBeLessThanOrEqual(30)
  })

  it('every entry matches the DeepStar shape', () => {
    for (const star of DEEP_STARS) {
      expect(typeof star.x).toBe('number')
      expect(typeof star.y).toBe('number')
      expect(typeof star.r).toBe('number')
      expect(typeof star.op).toBe('number')
    }
  })
})
