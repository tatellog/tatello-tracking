import { buildInsightDetail, longestStreak } from '../month-insight'
import type { MonthPattern } from '../month-built'
import { mkSig } from './signals.fixture'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }

/** Un patrón de movimiento (constancia) para las pruebas. */
const movementPattern: MonthPattern = {
  id: 'consistent-training',
  kind: 'discovery',
  label: 'Movimiento',
  title: 'El movimiento fue una de tus constantes.',
  evidence: {
    bars: [{ label: 'Movimiento', value: 0, total: 31, colorKey: 'cuerpo' }],
    caption: '',
    unit: 'días',
  },
  why: 'Los días que te moviste se acumularon.',
}

/** N días desde 2026-07-01, con override por día. */
function month(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    const day = `2026-07-${String(i + 1).padStart(2, '0')}`
    out.push(mkSig(day, { calories: 1300, meal_count: 3, ...override(i) }))
  }
  return out
}

describe('longestStreak', () => {
  it('cuenta la racha más larga de true', () => {
    expect(longestStreak([true, true, false, true, true, true, false])).toBe(3)
    expect(longestStreak([false, false])).toBe(0)
    expect(longestStreak([true])).toBe(1)
  })
})

describe('buildInsightDetail', () => {
  it('deriva evidencia por día, conteo y explicación del movimiento', () => {
    // Movió los primeros 5 días, luego no.
    const signals = month(20, (i) => ({ trained: i < 5 }))
    const d = buildInsightDetail(movementPattern, signals, CTX)
    expect(d.title).toBe('Movimiento')
    expect(d.headline).toBe('El movimiento fue una de tus constantes.')
    expect(d.colorKey).toBe('cuerpo')
    expect(d.progress).toEqual({ value: 5, total: 20 })
    expect(d.explanation).toBe('Te moviste 5 de 20 días este mes.')
    expect(d.secondary).toBe('Continuidad más larga: 5 días')
    expect(d.evidenceDays.filter(Boolean)).toHaveLength(5)
    expect(d.reflectionKey).toBe('pattern_consistent-training')
    expect(d.reflectionOptions.map((o) => o.answer)).toEqual(['si', 'no', 'nunca'])
  })

  it('el siguiente paso incluye observaciones con voz Observadora + explorar otro', () => {
    const signals = month(20, (i) => ({ trained: i < 8, calories: i < 8 ? 1200 : 1800 }))
    const d = buildInsightDetail(movementPattern, signals, CTX)
    const explore = d.nextSteps.find((s) => s.kind === 'explore-other')
    expect(explore?.label).toBe('Explorar otro hallazgo')
    const cross = d.nextSteps.find((s) => s.label === 'Cómo se relaciona con mi déficit')
    // Voz Observadora: describe registros, no aconseja.
    if (cross && cross.kind === 'observation') {
      expect(cross.observation).toMatch(/también estuviste en déficit/)
      expect(cross.observation).not.toMatch(/deberías|tienes que/)
    }
  })

  it('cierra el loop: antepone lo que respondió un mes anterior', () => {
    const signals = month(20, (i) => ({ trained: i < 5 }))
    const prior: Record<string, { month: string; answer: string }> = {
      'pattern_consistent-training': { month: '2026-05', answer: 'no' },
    }
    const d = buildInsightDetail(movementPattern, signals, CTX, prior)
    expect(d.priorCallback).toMatch(/mayo/)
  })
})
