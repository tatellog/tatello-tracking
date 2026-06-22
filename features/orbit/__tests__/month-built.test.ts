import {
  biggestWin,
  buildMonthBuilt,
  detectMonthPatterns,
  WATER_GOAL_GLASSES,
} from '../month-built'
import { addDays, mkSig } from './signals.fixture'

const BASE = '2026-06-01' // lunes

/** n días consecutivos desde BASE, cada uno con el override dado. */
const month = (n: number, o: (i: number) => Parameters<typeof mkSig>[1]) =>
  Array.from({ length: n }, (_, i) => mkSig(addDays(BASE, i), o(i)))

describe('buildMonthBuilt', () => {
  it('cuenta lo construido del mes', () => {
    const signals = month(20, (i) => ({
      trained: i % 3 === 0, // entrenos
      meal_count: i < 15 ? 2 : 0, // días con comida
      protein_g: i < 10 ? 80 : null, // proteína (avg)
      water_glasses: i < 6 ? WATER_GOAL_GLASSES : 3, // días alcanzando agua
      sleep_minutes: 360, // 6.0 h
    }))
    const b = buildMonthBuilt(signals)
    expect(b.daysAppeared).toBe(20)
    expect(b.trainedDays).toBe(Math.ceil(20 / 3)) // i=0,3,...,18 → 7
    expect(b.foodDays).toBe(15)
    expect(b.proteinAvgG).toBe(80)
    expect(b.waterGoalDays).toBe(6)
    expect(b.sleepAvgH).toBe(6)
  })

  it('promedios null sin datos de esa señal', () => {
    const b = buildMonthBuilt(month(10, () => ({ trained: true })))
    expect(b.proteinAvgG).toBeNull()
    expect(b.sleepAvgH).toBeNull()
    expect(b.waterGoalDays).toBe(0)
  })
})

describe('detectMonthPatterns', () => {
  it('mes apenas formado (<8 días) → sin patrones', () => {
    expect(detectMonthPatterns(month(5, () => ({ meal_count: 2 })))).toEqual([])
  })

  it('detecta hábito más y menos constante', () => {
    // Comida todos los días, agua pocos → comida más constante, agua menos.
    const signals = month(14, (i) => ({
      meal_count: 2, // 14 días
      sleep_minutes: i < 9 ? 360 : null, // 9 días
      water_glasses: i < 3 ? 2 : 0, // 3 días
    }))
    const ps = detectMonthPatterns(signals)
    expect(ps.find((p) => p.id === 'habit-top')?.title).toMatch(/Comida es tu hábito más constante/)
    expect(ps.find((p) => p.id === 'habit-low')?.title).toMatch(/Agua es tu hábito menos constante/)
    // La evidencia trae barras con días por hábito.
    const top = ps.find((p) => p.id === 'habit-top')!
    expect(top.evidence.bars.find((b) => b.label === 'Comida')?.value).toBe(14)
    expect(top.evidence.bars.find((b) => b.label === 'Comida')?.highlight).toBe(true)
  })

  it('detecta "apareces más entre semana"', () => {
    // 14 días desde lunes: registra solo lun-vie (entre semana), salta sáb/dom.
    const signals = month(14, (i) => ({ meal_count: 2 })).filter((s) => {
      const wd = (new Date(`${s.day}T00:00:00Z`).getUTCDay() + 6) % 7
      return wd < 5
    })
    const ps = detectMonthPatterns(signals)
    // Necesita ≥8 días; 14 días → 10 entre semana. Patrón presente.
    expect(ps.some((p) => p.id === 'weekday')).toBe(true)
  })
})

describe('biggestWin', () => {
  it('escala la línea con los días aparecidos', () => {
    expect(biggestWin(month(22, () => ({ meal_count: 1 })))?.line).toMatch(/superpoder/i)
    expect(biggestWin(month(14, () => ({ meal_count: 1 })))?.line).toMatch(/hábito real/i)
    expect(biggestWin(month(5, () => ({ meal_count: 1 })))?.line).toMatch(/suma/i)
    expect(biggestWin(month(22, () => ({ meal_count: 1 })))?.headline).toBe(
      'Apareciste 22 días este mes.',
    )
  })

  it('null sin días', () => {
    expect(biggestWin([])).toBeNull()
  })
})
