import { ZODIAC } from '../data'
import type { ZodiacSign } from '../types'

const SIGNS: ZodiacSign[] = [
  'aries',
  'tauro',
  'geminis',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'escorpio',
  'sagitario',
  'capricornio',
  'acuario',
  'piscis',
]

const ANCHOR_MAG_CEILING = 2

describe.each(SIGNS)('ZODIAC[%s]', (sign) => {
  const def = ZODIAC[sign]

  it('has a non-empty star list', () => {
    expect(def.stars.length).toBeGreaterThanOrEqual(5)
  })

  it('has a non-empty line list', () => {
    expect(def.lines.length).toBeGreaterThanOrEqual(4)
  })

  it('all stars sit inside [0,1] with sub-pixel slack', () => {
    for (const s of def.stars) {
      expect(s.x).toBeGreaterThanOrEqual(-0.01)
      expect(s.x).toBeLessThanOrEqual(1.01)
      expect(s.y).toBeGreaterThanOrEqual(-0.01)
      expect(s.y).toBeLessThanOrEqual(1.01)
    }
  })

  it('all line indices reference existing stars', () => {
    for (const [a, b] of def.lines) {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(def.stars.length)
      expect(b).toBeLessThan(def.stars.length)
      expect(a).not.toBe(b)
    }
  })

  it('every star is reachable from the line graph', () => {
    if (def.lines.length === 0) return
    const adj = new Map<number, Set<number>>()
    for (let i = 0; i < def.stars.length; i++) adj.set(i, new Set())
    for (const [a, b] of def.lines) {
      adj.get(a)!.add(b)
      adj.get(b)!.add(a)
    }
    // BFS from the first star — every other star should be reachable
    // for the figure to read as a single connected silhouette.
    const seen = new Set<number>([0])
    const queue: number[] = [0]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const next of adj.get(cur)!) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    // Tauro is a documented exception: the Pleiades cluster is drawn
    // as a separate two-star asterism alongside the main bull figure.
    if (sign === 'tauro') {
      expect(seen.size).toBeGreaterThanOrEqual(def.stars.length - 2)
    } else {
      expect(seen.size).toBe(def.stars.length)
    }
  })

  it('has at least one anchor star bright enough to sparkle', () => {
    const anchors = def.stars.filter((s) => s.mag <= ANCHOR_MAG_CEILING)
    expect(anchors.length).toBeGreaterThanOrEqual(1)
  })

  it('label and glyph are populated', () => {
    expect(def.label.length).toBeGreaterThan(0)
    expect(def.glyph.length).toBeGreaterThan(0)
  })
})
