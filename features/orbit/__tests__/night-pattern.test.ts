import type { Meal } from '@/features/macros/api'

import { detectNightPattern } from '../night-pattern'

/** Minimal meal — the detector only reads consumed_at. */
function meal(consumed_at: string): Meal {
  return { consumed_at } as unknown as Meal
}

/** Monday-first weekday a UTC timestamp lands on in CDMX (UTC-6). */
function cdmxWd(consumedAt: string): number {
  const d = new Date(new Date(consumedAt).getTime() - 6 * 3600_000)
  return (d.getUTCDay() + 6) % 7
}

describe('detectNightPattern', () => {
  test('false positive — only daytime meals → null', () => {
    // 21:00Z = 15:00 CDMX — daytime.
    const meals = Array.from({ length: 6 }, (_, i) => meal(`2026-06-0${i + 1}T21:00:00Z`))
    expect(detectNightPattern(meals)).toBeNull()
  })

  test('borderline — under the minimum late nights → null', () => {
    // 08:00Z = 02:00 CDMX — night, but only 3 of them.
    const meals = [
      meal('2026-05-04T08:00:00Z'),
      meal('2026-05-11T08:00:00Z'),
      meal('2026-05-18T08:00:00Z'),
    ]
    expect(detectNightPattern(meals)).toBeNull()
  })

  test('happy — 2 AM meals (clock hour 2!) count as night and cluster', () => {
    // Five 02:00-CDMX meals on Wednesdays (08:00Z) + one on a Sunday.
    const wednesdays = [
      '2026-05-06T08:00:00Z',
      '2026-05-13T08:00:00Z',
      '2026-05-20T08:00:00Z',
      '2026-05-27T08:00:00Z',
      '2026-06-03T08:00:00Z',
    ]
    const meals = [...wednesdays.map(meal), meal('2026-05-10T08:00:00Z')]
    const p = detectNightPattern(meals)
    expect(p).not.toBeNull()
    expect(p!.id).toBe('night-eating')
    expect(p!.title).toBe('¿Las noches piden más?')
    // Focus = the weekday the late meals gather on.
    expect(p!.data.kind).toBe('weekday')
    if (p!.data.kind === 'weekday') {
      expect(p!.data.focus).toBe(cdmxWd('2026-05-06T08:00:00Z'))
    }
    expect(p!.confidence).toBe('alta') // 6 late nights
  })

  test('late-evening meals (22:00 CDMX) also count', () => {
    // 22:00 CDMX = 04:00Z next day.
    const meals = [
      meal('2026-05-05T04:00:00Z'),
      meal('2026-05-12T04:00:00Z'),
      meal('2026-05-19T04:00:00Z'),
      meal('2026-05-26T04:00:00Z'),
    ]
    const p = detectNightPattern(meals)
    expect(p).not.toBeNull()
    expect(p!.confidence).toBe('media') // exactly 4
  })

  test('severe — near-daily sustained late eating is SUPPRESSED, not coached', () => {
    // 30 late-night meals over 5 weeks (near-daily) → manifiesto red line:
    // not the cheerful card. Returns null until the referral flow exists.
    const meals = Array.from({ length: 30 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0')
      return meal(`2026-05-${day}T08:00:00Z`)
    })
    expect(detectNightPattern(meals)).toBeNull()
  })

  test('voice — subject is the night, never the user; no clinical words', () => {
    // Cluster on Wednesdays so the pattern actually fires.
    const meals = [
      '2026-05-06T08:00:00Z',
      '2026-05-13T08:00:00Z',
      '2026-05-20T08:00:00Z',
      '2026-05-27T08:00:00Z',
      '2026-06-03T08:00:00Z',
    ].map(meal)
    const p = detectNightPattern(meals)!
    const blob =
      `${p.title} ${p.detail} ${p.legend} ${p.voz} ${p.correlacion} ${p.experimento.hint}`.toLowerCase()
    for (const banned of ['atracón', 'atracon', 'trastorno', 'culpa', 'debes', 'tienes que']) {
      expect(blob).not.toContain(banned)
    }
  })
})
