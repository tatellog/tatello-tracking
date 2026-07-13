import type { BodyCheckin, BodyComposition, TimelinePhoto } from '../api'
import { compositionSeries, compositionSummary, photoAt, photoDatesFor } from '../logic'

const comp = (day: string, o: Partial<BodyComposition> = {}): BodyComposition => ({
  day_date: day,
  body_fat_pct: null,
  lean_body_mass_kg: null,
  bmi: null,
  ...o,
})

const photo = (day: string, angle: TimelinePhoto['angle'], id = day): TimelinePhoto => ({
  id: `${id}-${angle}`,
  taken_at: `${day}T12:00:00Z`,
  angle,
  signed_url: `https://x/${id}`,
})

describe('compositionSummary — cards de composición (Epic 02)', () => {
  it('emite una card por métrica CON datos, con delta vs la primera', () => {
    const rows = [
      comp('2026-07-01', { body_fat_pct: 32.4, bmi: 27.1 }),
      comp('2026-07-10', { body_fat_pct: 31.2 }),
      comp('2026-07-20', { body_fat_pct: 30.9, bmi: 26.5 }),
    ]
    const cards = compositionSummary(rows)
    const fat = cards.find((c) => c.key === 'body_fat_pct')!
    expect(fat.current).toBe(30.9)
    expect(fat.delta).toBe(-1.5)
    expect(fat.lastDate).toBe('2026-07-20')
    const bmi = cards.find((c) => c.key === 'bmi')!
    expect(bmi.delta).toBe(-0.6)
    // Masa magra sin datos → NO hay card (sin cascarones vacíos).
    expect(cards.find((c) => c.key === 'lean_body_mass_kg')).toBeUndefined()
  })

  it('con una sola medición: card sin delta (no hay contra qué comparar)', () => {
    const cards = compositionSummary([comp('2026-07-15', { lean_body_mass_kg: 48.2 })])
    expect(cards).toHaveLength(1)
    expect(cards[0]!.delta).toBeNull()
  })

  it('sin datos → sin cards', () => {
    expect(compositionSummary([])).toEqual([])
  })
})

describe('compositionSeries — series por métrica, check-in gana el día (F2)', () => {
  const checkin = (day: string, o: Partial<BodyCheckin>): BodyCheckin =>
    ({ id: day, measured_on: day, source: 'coach', ...o }) as BodyCheckin

  it('fusiona fuentes por métrica; el check-in pisa al wearable en su día', () => {
    const wearable = [
      comp('2026-07-01', { body_fat_pct: 31.0, lean_body_mass_kg: 48.0 }),
      comp('2026-07-10', { body_fat_pct: 30.5 }),
    ]
    const checkins = [checkin('2026-07-01', { body_fat_pct: 32.0, muscle_kg: 43.2, water_pct: 51 })]
    const s = compositionSeries(checkins, wearable)
    // Grasa: el check-in gana el 07-01 (32.0), el wearable aporta el 07-10.
    expect(s.body_fat_pct.map((p) => p.value)).toEqual([32.0, 30.5])
    // Músculo (InBody) y masa magra (wearable) son series SEPARADAS.
    expect(s.muscle_kg).toHaveLength(1)
    expect(s.lean_kg.map((p) => p.value)).toEqual([48.0])
    expect(s.water_pct[0]!.value).toBe(51)
  })

  it('sin datos → series vacías (las cards se auto-ocultan)', () => {
    const s = compositionSeries([], [])
    expect(s.body_fat_pct).toEqual([])
    expect(s.muscle_kg).toEqual([])
  })
})

describe('photoDatesFor / photoAt — comparador por fechas', () => {
  const photos = [
    photo('2026-06-01', 'front'),
    photo('2026-06-01', 'back'),
    photo('2026-07-01', 'front'),
    photo('2026-07-01', 'front', 'later'), // dos del mismo día → gana la última
  ]

  it('lista fechas únicas ascendentes por ángulo', () => {
    expect(photoDatesFor(photos, 'front')).toEqual(['2026-06-01', '2026-07-01'])
    expect(photoDatesFor(photos, 'back')).toEqual(['2026-06-01'])
    expect(photoDatesFor(photos, 'side_left')).toEqual([])
  })

  it('devuelve la foto del ángulo en la fecha (la última del día)', () => {
    expect(photoAt(photos, 'front', '2026-07-01')?.id).toBe('later-front')
    expect(photoAt(photos, 'back', '2026-07-01')).toBeNull()
  })
})
