import {
  biggestWin,
  buildMonthBuilt,
  detectMonthPatterns,
  finalPhrase,
  habitReveal,
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

  it('NO produce "señal más silenciosa" (eliminada: contaba en otra escala)', () => {
    // "Haz visible lo invisible" es solo constancias POSITIVAS; lo que faltó lo
    // cuentan "Lo que aún no sabemos" + "Tu evolución".
    const signals = month(14, (i) => ({
      meal_count: 2,
      sleep_minutes: i < 9 ? 360 : null,
      water_glasses: i < 3 ? 2 : 0,
    }))
    const ps = detectMonthPatterns(signals)
    expect(ps.some((p) => p.id === 'habit-low')).toBe(false)
    // Todo descubrimiento es una constancia positiva, ninguno una carencia.
    for (const p of ps.filter((x) => x.kind === 'discovery')) {
      expect(p.title).not.toMatch(/silenciosa|menos|faltó/i)
    }
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

describe('habitReveal', () => {
  it('cuenta días con evidencia por dimensión, ordenado desc', () => {
    const signals = month(20, (i) => ({
      meal_count: 2, // comida 20
      trained: i < 12, // movimiento 12
      sleep_minutes: i < 15 ? 400 : null, // sueño 15
      protein_g: i < 8 ? 90 : null, // proteína 8
      water_glasses: i < 5 ? 4 : 0, // agua 5
      energy: i < 18 ? 3 : null, // energía 18
      on_period: i < 4 ? true : null, // ciclo: NO se cuenta (contexto, no hábito)
    }))
    const r = habitReveal(signals)
    // Ordenado de mayor a menor.
    expect(r.map((h) => h.count)).toEqual([...r.map((h) => h.count)].sort((a, b) => b - a))
    const by = Object.fromEntries(r.map((h) => [h.key, h.count]))
    expect(by.comida).toBe(20)
    expect(by.cuerpo).toBe(12)
    expect(by.sueno).toBe(15)
    expect(by.proteina).toBe(8)
    expect(by.agua).toBe(5)
    expect(by.energia).toBe(18)
    // Ciclo es contexto, no hábito: no aparece como dimensión de presencia.
    expect(by.ciclo).toBeUndefined()
  })

  it('cubre las 6 dimensiones de presencia (sin ciclo) aunque estén en cero', () => {
    const r = habitReveal(month(5, () => ({ meal_count: 1 })))
    expect(r).toHaveLength(6)
    expect(r.some((h) => h.key === 'ciclo')).toBe(false)
    expect(r.find((h) => h.key === 'agua')?.count).toBe(0)
  })
})

describe('detectMonthPatterns · kind / secciones', () => {
  it('etiqueta constancia como discovery y forma temporal como pattern', () => {
    const signals = month(16, (i) => ({
      trained: i < 10, // consistent-training (discovery)
      protein_g: i < 12 ? 100 : null,
      meal_count: 2,
    })).filter((s) => (new Date(`${s.day}T00:00:00Z`).getUTCDay() + 6) % 7 < 5) // solo entre semana
    const ps = detectMonthPatterns(signals, { proteinTarget: 90 })
    const train = ps.find((p) => p.id === 'consistent-training')!
    expect(train.kind).toBe('discovery')
    expect(train.label).toBe('Movimiento')
    const weekday = ps.find((p) => p.id === 'weekday')
    expect(weekday?.kind).toBe('pattern')
  })

  it('detecta noches con ≥ 7 h de sueño (pattern demostrable)', () => {
    // 16 noches registradas, 10 de ellas ≥ 7 h (420 min).
    const signals = month(16, (i) => ({
      sleep_minutes: i < 10 ? 440 : 360,
      meal_count: 2,
    }))
    const deep = detectMonthPatterns(signals).find((p) => p.id === 'sleep-7h')!
    expect(deep).toBeTruthy()
    expect(deep.kind).toBe('pattern')
    expect(deep.title).toContain('10 noches')
    expect(deep.evidence.bars.find((b) => b.label === '≥ 7 h')?.value).toBe(10)
  })
})

describe('finalPhrase', () => {
  it('escala la frase con los días presentes y todas se sostienen con datos', () => {
    expect(finalPhrase(month(20, () => ({ meal_count: 1 })))).toMatch(/constancia/i)
    expect(finalPhrase(month(12, () => ({ meal_count: 1 })))).toMatch(/repetiste/i)
    expect(finalPhrase(month(4, () => ({ meal_count: 1 })))).toMatch(/evidencia/i)
  })

  it('null sin días', () => {
    expect(finalPhrase([])).toBeNull()
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
