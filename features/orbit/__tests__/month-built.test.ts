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

  it('detecta el hábito menos constante (observación local de Mes)', () => {
    // Comida todos los días, agua pocos → agua es el menos constante.
    const signals = month(14, (i) => ({
      meal_count: 2, // 14 días
      sleep_minutes: i < 9 ? 360 : null, // 9 días
      water_glasses: i < 3 ? 2 : 0, // 3 días
    }))
    const ps = detectMonthPatterns(signals)
    const low = ps.find((p) => p.id === 'habit-low')!
    expect(low.title).toMatch(/El agua fue tu señal más silenciosa/)
    expect(low.evidence.bars.find((b) => b.label === 'Agua')?.highlight).toBe(true)
  })

  it('NO contradice: si el movimiento fue una constante, no es la "más silenciosa"', () => {
    // Entrena 10 días (constancia de movimiento) pero los demás hábitos
    // aparecen los 14 → sin dedupe, "movimiento" saldría como el más silencioso
    // a la vez que constante. El dedupe por dimensión lo impide.
    const signals = month(14, (i) => ({
      trained: i < 10,
      meal_count: 2,
      sleep_minutes: 360,
      energy: 3,
      water_glasses: 1,
    }))
    const ps = detectMonthPatterns(signals)
    expect(ps.some((p) => p.id === 'consistent-training')).toBe(true)
    expect(ps.some((p) => p.id === 'habit-low' && /movimiento/i.test(p.title))).toBe(false)
  })

  it('consume los patrones POSITIVOS del motor (proteína/movimiento/sueño)', () => {
    // 16 días: entreno y proteína en meta ≥8 días, sueño ≥6.5h ≥8 noches.
    const signals = month(16, (i) => ({
      trained: i < 10, // 10 días → training_consistent (≥8)
      protein_g: i < 12 ? 100 : null, // 12 días en meta
      sleep_minutes: i < 9 ? 420 : 300, // 9 noches ≥6.5h
      meal_count: 2,
    }))
    const ps = detectMonthPatterns(signals, { proteinTarget: 90 })
    expect(ps.find((p) => p.id === 'consistent-training')).toBeTruthy()
    expect(ps.find((p) => p.id === 'consistent-protein')).toBeTruthy()
    expect(ps.find((p) => p.id === 'consistent-sleep')).toBeTruthy()
    // El de proteína resalta su barra y trae el conteo del motor.
    const prot = ps.find((p) => p.id === 'consistent-protein')!
    expect(prot.evidence.bars.find((b) => b.label === 'Proteína')?.highlight).toBe(true)
    expect(prot.evidence.bars.find((b) => b.label === 'Proteína')?.value).toBe(12)
  })

  it('sin meta de proteína, el patrón de proteína no dispara', () => {
    const signals = month(16, () => ({ protein_g: 100, meal_count: 2 }))
    const ps = detectMonthPatterns(signals) // sin proteinTarget
    expect(ps.find((p) => p.id === 'consistent-protein')).toBeUndefined()
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
    expect(biggestWin(month(22, () => ({ meal_count: 1 })))?.line).toMatch(/constancia/i)
    expect(biggestWin(month(14, () => ({ meal_count: 1 })))?.line).toMatch(/ritmo/i)
    expect(biggestWin(month(5, () => ({ meal_count: 1 })))?.line).toMatch(/suma/i)
    expect(biggestWin(month(22, () => ({ meal_count: 1 })))?.headline).toBe(
      'Estuviste presente 22 días este mes.',
    )
  })

  it('null sin días', () => {
    expect(biggestWin([])).toBeNull()
  })
})
