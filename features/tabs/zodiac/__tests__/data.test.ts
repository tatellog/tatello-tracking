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
    // 4 = the smallest authentic asterism (e.g. the Aries four-star
    // bent line). Anything below that isn't a recognisable figure.
    expect(def.stars.length).toBeGreaterThanOrEqual(4)
  })

  it('has a non-empty line list', () => {
    expect(def.lines.length).toBeGreaterThanOrEqual(3)
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

  it('the lined stars form one connected figure', () => {
    if (def.lines.length === 0) return
    const adj = new Map<number, Set<number>>()
    const lined = new Set<number>()
    for (let i = 0; i < def.stars.length; i++) adj.set(i, new Set())
    for (const [a, b] of def.lines) {
      adj.get(a)!.add(b)
      adj.get(b)!.add(a)
      lined.add(a)
      lined.add(b)
    }
    // BFS from the first lined star — every other star that appears
    // in a line should be reachable, so the drawn silhouette reads as
    // one connected figure. Stars in no line at all are deliberate
    // unconnected field stars (e.g. Aries) and are excluded here.
    const start = [...lined][0]!
    const seen = new Set<number>([start])
    const queue: number[] = [start]
    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const next of adj.get(cur)!) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    expect(seen.size).toBe(lined.size)
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
