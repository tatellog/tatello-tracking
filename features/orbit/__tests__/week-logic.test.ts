import { deriveDimensions } from '../logic'
import {
  buildEnLuzSemana,
  buildVozSemanaReal,
  buildWeekDaysReal,
  buildWeekRecap,
  dayBrightness,
} from '../week-logic'
import { LOW, mkSig, STRONG } from './signals.fixture'

describe('dayBrightness', () => {
  test('no signal → the dim floor (~0.14)', () => {
    expect(dayBrightness(deriveDimensions(null))).toBeCloseTo(0.14, 5)
  })

  test('a broadly-lit day reads bright (>0.6)', () => {
    expect(dayBrightness(deriveDimensions(mkSig('2026-06-03', STRONG)))).toBeGreaterThan(0.6)
  })
})

describe('buildWeekDaysReal', () => {
  test('no signals → 7 days, all at the floor, exactly one is today', () => {
    const days = buildWeekDaysReal([], 6)
    expect(days).toHaveLength(7)
    for (const d of days) {
      expect(d.brightness).toBeCloseTo(0.14, 2)
      expect(d.archetype).toBe('quieta')
      expect(d.dimEnLuz).toBe(0)
    }
    expect(days[6]!.today).toBe(true)
    expect(days.filter((d) => d.today)).toHaveLength(1)
  })

  test('future days are blank stations', () => {
    const days = buildWeekDaysReal([], 2) // today = Tuesday (idx 2)
    for (let i = 3; i < 7; i++) {
      expect(days[i]!.brightness).toBe(0)
      expect(days[i]!.archetype).toBe('')
      expect(days[i]!.note).toBe('Aún no llega.')
    }
  })

  test('a strong signal lights exactly its own weekday', () => {
    // todayIdx = 6 → no day is in the future, so the signal's weekday lights.
    const days = buildWeekDaysReal([mkSig('2026-06-03', STRONG)], 6)
    const bright = days.filter((d) => d.brightness > 0.5)
    expect(bright).toHaveLength(1)
    expect(bright[0]!.archetype).toBe('brillante')
    expect(bright[0]!.dimEnLuz).toBeGreaterThanOrEqual(4)
    expect(bright[0]!.note).toMatch(/en luz/)
  })

  test('a day with NO row reads as "no records" (past + today voices)', () => {
    const days = buildWeekDaysReal([], 6)
    expect(days[0]!.note).toBe('Sin registros este día.')
    expect(days[6]!.note).toBe('Hoy todavía no hay registros.')
  })

  test('a logged day with nothing en luz reads as a calm note (not "no records")', () => {
    const days = buildWeekDaysReal([mkSig('2026-06-03', LOW)], 6)
    const dim = days.find((d) => d.brightness > 0.2 && d.brightness < 0.4)
    expect(dim).toBeDefined()
    expect(dim!.note).toMatch(/callada|voz baja/)
    expect(dim!.note).not.toMatch(/Sin registros/)
  })
})

describe('buildVozSemanaReal', () => {
  // Tres entrenos en días distintos (Dom/Lun/Mar) → una repetición real.
  const threeTrained = [
    mkSig('2026-05-31', { trained: true }),
    mkSig('2026-06-01', { trained: true }),
    mkSig('2026-06-02', { trained: true }),
  ]

  test('sin repeticiones → línea serena, sin patrón inventado', () => {
    const text = buildVozSemanaReal([], 3)
      .parts.map((p) => p.text)
      .join('')
    expect(text).toContain('Aún no se repite nada')
    expect(text).toContain('sigue escribiéndose')
  })

  test('describe la repetición principal en pasado factual', () => {
    const text = buildVozSemanaReal(threeTrained, 6)
      .parts.map((p) => p.text)
      .join('')
    expect(text).toContain('Te moviste')
    expect(text).toContain('3 veces')
  })

  test('confidence grows with days read', () => {
    expect(buildVozSemanaReal([], 0).signature.confidence).toBe('baja')
    expect(buildVozSemanaReal([], 3).signature.confidence).toBe('media')
    expect(buildVozSemanaReal([], 6).signature.confidence).toBe('alta')
  })

  test('nunca usa causas ni predicciones prohibidas (PRD)', () => {
    const text = buildVozSemanaReal(threeTrained, 6)
      .parts.map((p) => p.text)
      .join('')
    expect(text).not.toMatch(/porque|debido a|causó|suele|mañana/i)
  })
})

describe('buildEnLuzSemana', () => {
  test('elige el comportamiento más repetido (≥3 días)', () => {
    const enLuz = buildEnLuzSemana(
      [
        mkSig('2026-05-31', { trained: true }), // Dom (0)
        mkSig('2026-06-01', { trained: true }), // Lun (1)
        mkSig('2026-06-02', { trained: true }), // Mar (2)
      ],
      6,
    )
    expect(enLuz).not.toBeNull()
    expect(enLuz!.key).toBe('cuerpo')
    expect(enLuz!.count).toBe(3)
    expect(enLuz!.days).toEqual([0, 1, 2])
  })

  test('menos de 3 ocurrencias → null (no se inventa patrón)', () => {
    const enLuz = buildEnLuzSemana(
      [mkSig('2026-05-31', { trained: true }), mkSig('2026-06-01', { trained: true })],
      6,
    )
    expect(enLuz).toBeNull()
  })
})

describe('buildWeekRecap', () => {
  // 2026-05-31 Sun(0), 06-01 Mon(1), 06-02 Tue(2), 06-03 Wed(3).
  test('totals: entrenos counted, meals summed, averages over logged days', () => {
    const recap = buildWeekRecap(
      [
        mkSig('2026-05-31', { trained: true, meal_count: 3, sleep_minutes: 480, water_glasses: 6 }),
        mkSig('2026-06-01', { trained: true, meal_count: 2, sleep_minutes: 420 }),
        mkSig('2026-06-02', { meal_count: 4, water_glasses: 8 }),
        mkSig('2026-06-03', { trained: true }),
      ],
      3,
    )
    expect(recap.entrenos).toBe(3)
    expect(recap.meals).toBe(9)
    expect(recap.sleepAvgMin).toBe(450) // (480+420)/2, the two days that logged sleep
    expect(recap.waterAvg).toBe(7) // (6+8)/2
  })

  test('a metric with no day logged is null (UI shows "—", never a 0)', () => {
    const recap = buildWeekRecap([mkSig('2026-06-01', { trained: true })], 3)
    expect(recap.sleepAvgMin).toBeNull()
    expect(recap.waterAvg).toBeNull()
    expect(recap.entrenos).toBe(1)
    expect(recap.meals).toBe(0)
  })

  test('future days (beyond today) are not counted', () => {
    // 2026-06-05 is Friday (idx 5); with today = Wednesday (3) it must be ignored.
    const recap = buildWeekRecap(
      [
        mkSig('2026-06-01', { trained: true }),
        mkSig('2026-06-05', { trained: true, meal_count: 3 }),
      ],
      3,
    )
    expect(recap.entrenos).toBe(1)
    expect(recap.meals).toBe(0)
  })
})
