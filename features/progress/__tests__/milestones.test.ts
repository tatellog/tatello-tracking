import { mkSig } from '../../orbit/__tests__/signals.fixture'
import { DEFICIT_MONTH_DAYS, detectMilestones } from '../milestones'

const CTX = { calorieTarget: 1500 }

/** N días desde 2026-07-01 con override por día. */
function days(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(mkSig(`2026-07-${String(i + 1).padStart(2, '0')}`, override(i)))
  }
  return out
}

const byKind = (ms: ReturnType<typeof detectMilestones>) =>
  Object.fromEntries(ms.map((m) => [m.kind, m]))

describe('detectMilestones — hitos de primera vez (T-R3.2)', () => {
  it('primer día en déficit: la primera fecha, no una posterior', () => {
    // Superávit los días 1-2, déficit desde el 3.
    const signals = days(6, (i) => ({ calories: i < 2 ? 1900 : 1200 }))
    const m = byKind(detectMilestones({ signals, ...CTX }))
    expect(m.first_deficit).toBeDefined()
    expect(m.first_deficit!.date).toBe('2026-07-03')
    expect(m.first_deficit!.title).toMatch(/déficit/)
  })

  it('un mes en déficit: la fecha del día en déficit número 20', () => {
    const signals = days(25, () => ({ calories: 1200 })) // todos en déficit
    const m = byKind(detectMilestones({ signals, ...CTX }))
    expect(DEFICIT_MONTH_DAYS).toBe(20)
    expect(m.deficit_month!.date).toBe('2026-07-20')
  })

  it('sin llegar a 20 días en déficit → no hay hito de mes', () => {
    const signals = days(10, () => ({ calories: 1200 }))
    const m = byKind(detectMilestones({ signals, ...CTX }))
    expect(m.first_deficit).toBeDefined()
    expect(m.deficit_month).toBeUndefined()
  })

  it('primer pesaje y primer entreno: la primera fecha con ese dato', () => {
    const signals = days(8, (i) => ({
      calories: 1600,
      weight_kg: i >= 3 ? 70 : null,
      trained: i >= 5,
    }))
    const m = byKind(detectMilestones({ signals, ...CTX }))
    expect(m.first_weight!.date).toBe('2026-07-04')
    expect(m.first_workout!.date).toBe('2026-07-06')
  })

  it('sin datos → sin hitos', () => {
    expect(detectMilestones({ signals: [], ...CTX })).toEqual([])
  })

  it('déficit necesita calorieTarget (sin meta no hay hito de déficit)', () => {
    const signals = days(6, () => ({ calories: 1200 }))
    const m = byKind(detectMilestones({ signals }))
    expect(m.first_deficit).toBeUndefined()
  })

  it('salida en orden cronológico', () => {
    const signals = days(25, (i) => ({
      calories: 1200,
      weight_kg: i === 0 ? 72 : null,
      trained: i === 1,
    }))
    const dates = detectMilestones({ signals, ...CTX }).map((m) => m.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('desordenar la entrada no cambia el resultado (determinístico)', () => {
    const signals = days(6, (i) => ({ calories: i < 2 ? 1900 : 1200 }))
    const shuffled = [...signals].reverse()
    expect(detectMilestones({ signals: shuffled, ...CTX })).toEqual(
      detectMilestones({ signals, ...CTX }),
    )
  })
})
