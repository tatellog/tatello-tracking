import type { BodyCheckin, BodyComposition, TimelinePhoto } from '../api'
import type { BodyMeasurement } from '@/features/brief/api'

import {
  compareCheckins,
  compareSynthesis,
  compositionSeries,
  compositionSummary,
  compositionSynthesis,
  mergeWeightSeries,
  photoAt,
  photoDatesFor,
  photoNear,
  zoneEvolution,
} from '../logic'

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

describe('compareCheckins — cambios principales entre dos mediciones (F3)', () => {
  const mk = (day: string, o: Partial<BodyCheckin>): BodyCheckin =>
    ({ id: day, measured_on: day, source: 'coach', ...o }) as BodyCheckin

  it('solo métricas presentes en AMBAS; delta después−antes', () => {
    const a = mk('2024-08-15', { weight_kg: 69.3, body_fat_pct: 35.4, muscle_kg: 42.5 })
    const b = mk('2024-11-15', { weight_kg: 66.8, body_fat_pct: 31.1, water_pct: 51 })
    const rows = compareCheckins(a, b)
    expect(rows.find((r) => r.key === 'weight_kg')!.delta).toBe(-2.5)
    expect(rows.find((r) => r.key === 'body_fat_pct')!.delta).toBe(-4.3)
    // Músculo solo en A y agua solo en B → no se comparan contra huecos.
    expect(rows.find((r) => r.key === 'muscle_kg')).toBeUndefined()
    expect(rows.find((r) => r.key === 'water_pct')).toBeUndefined()
  })

  it('sin edad metabólica en el comparador (decisión producto)', () => {
    const a = mk('2024-08-15', { metabolic_age: 47, weight_kg: 69 })
    const b = mk('2025-08-15', { metabolic_age: 52, weight_kg: 72 })
    expect(compareCheckins(a, b).map((r) => r.key)).toEqual(['weight_kg'])
  })
})

describe('mergeWeightSeries — UNA sola verdad de peso (app + coach)', () => {
  const meas = (iso: string, kg: number): BodyMeasurement =>
    ({ id: iso, measured_at: iso, weight_kg: kg }) as unknown as BodyMeasurement
  const chk = (day: string, kg: number): BodyCheckin =>
    ({ id: day, measured_on: day, source: 'coach', weight_kg: kg }) as BodyCheckin

  it('fusiona ambas fuentes en una serie ascendente', () => {
    const fused = mergeWeightSeries(
      [meas('2026-06-06T08:00:00Z', 67.1)],
      [chk('2024-08-15', 69.3), chk('2025-08-15', 72.1)],
    )
    expect(fused.map((p) => p.weight)).toEqual([69.3, 72.1, 67.1])
  })

  it('mismo día: gana la medición propia (el ritual de la app)', () => {
    const fused = mergeWeightSeries([meas('2024-08-15T08:00:00Z', 69.0)], [chk('2024-08-15', 69.3)])
    expect(fused).toHaveLength(1)
    expect(fused[0]!.weight).toBe(69.0)
  })
})

describe('photoNear — tolerancia ±3 días para el cambio visual', () => {
  const p = (day: string): TimelinePhoto => ({
    id: day,
    taken_at: `${day}T12:00:00Z`,
    angle: 'front',
    signed_url: `https://x/${day}`,
  })

  it('encuentra la foto a ≤3 días del check-in; rechaza más lejos', () => {
    const photos = [p('2024-08-17')]
    expect(photoNear(photos, 'front', '2024-08-15')?.id).toBe('2024-08-17')
    expect(photoNear(photos, 'front', '2024-08-10')).toBeNull()
  })
})

describe('compositionSynthesis — la lectura de las cards (misma voz que el comparador)', () => {
  const chk = (day: string, o: Partial<BodyCheckin>): BodyCheckin =>
    ({ id: day, measured_on: day, source: 'coach', ...o }) as BodyCheckin

  it('separa rescates de hechos duros (los 4 ↑ de la usuaria)', () => {
    // Su caso real: grasa↑ + IMC↑ (duros) · músculo↑ + agua↑ (a favor).
    const series = compositionSeries(
      [
        chk('2024-08-15', { body_fat_pct: 35.4, muscle_kg: 42.5, water_pct: 47.9, bmi: 24.2 }),
        chk('2025-08-15', { body_fat_pct: 36.8, muscle_kg: 43.2, water_pct: 51, bmi: 25 }),
      ],
      [],
    )
    const s = compositionSynthesis(series)!
    expect(s).toContain('tu grasa')
    expect(s).toContain('ganaste músculo')
    expect(s).toContain('no empiezas de cero')
  })

  it('con una sola medición por métrica → null (no hay lectura que dar)', () => {
    const series = compositionSeries([chk('2024-08-15', { body_fat_pct: 35.4 })], [])
    expect(compositionSynthesis(series)).toBeNull()
  })
})

describe('compareSynthesis — la frase honesta del comparador', () => {
  const mk = (key: string, a: number, b: number) =>
    ({ key, a, b, delta: Number((b - a).toFixed(1)) }) as ReturnType<typeof compareCheckins>[number]

  it('recaída con rescate: separa hechos duros de lo ganado (no empiezas de cero)', () => {
    const s = compareSynthesis([
      mk('weight_kg', 69.3, 72.1),
      mk('body_fat_pct', 35.4, 36.8),
      mk('muscle_kg', 42.5, 43.2),
      mk('water_pct', 47.9, 51),
    ])!
    expect(s).toContain('Subió tu peso y tu grasa')
    expect(s).toContain('ganaste músculo')
    expect(s).toContain('no empiezas de cero')
    expect(s).not.toMatch(/culpa|fallaste|mal/i)
  })

  it('todo a favor: lo nombra sin inflar', () => {
    const s = compareSynthesis([mk('weight_kg', 72, 69), mk('body_fat_pct', 36, 32)])!
    expect(s).toContain('a tu favor')
  })

  it('todo duro: punto de partida, sin sentencia', () => {
    const s = compareSynthesis([mk('weight_kg', 69, 72), mk('body_fat_pct', 33, 36)])!
    expect(s).toContain('punto de partida')
    expect(s).not.toMatch(/fallaste|retroced|culpa/i)
  })

  it('sin cambios → null (silencio, no relleno)', () => {
    expect(compareSynthesis([mk('weight_kg', 70, 70)])).toBeNull()
    expect(compareSynthesis([])).toBeNull()
  })
})

describe('zoneEvolution — grasa por zona, primera → última (F4)', () => {
  const mk = (day: string, o: Partial<BodyCheckin>): BodyCheckin =>
    ({ id: day, measured_on: day, source: 'coach', ...o }) as BodyCheckin

  it('promedia lados, calcula deltas y marca la zona de mayor |cambio|', () => {
    const checkins = [
      mk('2024-08-15', {
        fat_arm_right_pct: 31.0,
        fat_arm_left_pct: 30.7,
        fat_trunk_pct: 33.0,
        fat_leg_right_pct: 40.4,
        fat_leg_left_pct: 40.5,
      }),
      mk('2024-11-15', {
        fat_arm_right_pct: 27.8,
        fat_arm_left_pct: 27.4,
        fat_trunk_pct: 28.4,
        fat_leg_right_pct: 36.2,
        fat_leg_left_pct: 36.5,
      }),
    ]
    const { zones, highlight } = zoneEvolution(checkins)
    const trunk = zones.find((z) => z.key === 'trunk')!
    expect(trunk.delta).toBe(-4.6)
    // Tronco −4.6 es el mayor cambio (brazos −3.3, piernas −4.1).
    expect(highlight).toBe('trunk')
    expect(zones.find((z) => z.key === 'arms')!.first).toBe(30.9) // promedio izq/der
  })

  it('sin ≥2 mediciones con esa zona, la zona no aparece (ni highlight)', () => {
    const { zones, highlight } = zoneEvolution([mk('2024-08-15', { fat_trunk_pct: 33 })])
    expect(zones).toEqual([])
    expect(highlight).toBeNull()
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
