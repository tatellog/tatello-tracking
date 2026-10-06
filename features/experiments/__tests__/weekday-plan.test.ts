import { mkSig } from '../../orbit/__tests__/signals.fixture'
import {
  buildExperimentScaffold,
  measureExperiment,
  onlyWeekday,
  planOptionsForWeekday,
  WEEKDAY_PLAN_DAYS,
  weekdayOf,
} from '../logic'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }
const FRI = 5

/** Días consecutivos desde una fecha, con override por fecha. */
function range(from: string, count: number, f: (day: string) => Record<string, unknown>) {
  const out = []
  const d = new Date(`${from}T00:00:00Z`)
  for (let i = 0; i < count; i++) {
    const day = d.toISOString().slice(0, 10)
    out.push(mkSig(day, f(day)))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

test('weekdayOf: 2026-10-09 es viernes', () => {
  expect(weekdayOf('2026-10-09')).toBe(FRI)
})

describe('buildExperimentScaffold · plan de un día', () => {
  const hyp = { id: 'h', sourceFindingId: 'weekday-diet-break' }
  const finding = { id: 'weekday-diet-break', category: 'deficit' as const }

  test('dura 4 semanas y guarda día, plan y hora', () => {
    const plan = buildExperimentScaffold(hyp, finding, {
      weekday: FRI,
      planText: '  Entrenar ese día  ',
      reminderMinutes: 780,
    })!
    expect(plan.durationDays).toBe(WEEKDAY_PLAN_DAYS)
    expect(plan).toMatchObject({ weekday: FRI, planText: 'Entrenar ese día', reminderMinutes: 780 })
  })
  test('sin día sigue siendo de 2 semanas; un día inválido no arma plan', () => {
    expect(buildExperimentScaffold(hyp, finding)!.durationDays).toBe(14)
    expect(buildExperimentScaffold(hyp, finding, { weekday: 9 })).toBeNull()
  })
})

describe('measureExperiment · solo cuentan los viernes', () => {
  const plan = {
    metric: 'deficit_days' as const,
    direction: 'increase' as const,
    durationDays: 28,
    weekday: FRI,
  }
  // 4 semanas desde el viernes 9 oct: viernes en déficit, el resto fuera.
  const win = range('2026-10-09', 28, (day) => ({
    calories: weekdayOf(day) === FRI ? 1300 : 2200,
  }))

  test('4 de 4 viernes en déficit vs base 1 de 4 → se sostuvo', () => {
    const m = measureExperiment(plan, win, { baselineRate: 0.25, baselineDaysMeasured: 4, ...CTX })
    expect(m.daysMeasured).toBe(4)
    expect(m.windowRate).toBe(1)
    expect(m.status).toBe('confirmed')
  })
  test('con 2 viernes registrados no alcanza para saberlo', () => {
    const two = win.filter((s) => s.day! < '2026-10-17')
    expect(
      measureExperiment(plan, two, { baselineRate: 0, baselineDaysMeasured: 4, ...CTX }).status,
    ).toBe('inconclusive')
  })
  test('base con menos de 3 viernes → inconclusa', () => {
    expect(
      measureExperiment(plan, win, { baselineRate: 0, baselineDaysMeasured: 2, ...CTX }).status,
    ).toBe('inconclusive')
  })
})

describe('planOptionsForWeekday · desde sus viernes buenos', () => {
  // 8 viernes: los 4 en déficit entrenaron y durmieron 7 h; los otros no.
  const history = range('2026-08-07', 56, (day) => {
    if (weekdayOf(day) !== FRI) return { calories: 1400 }
    const good = Number(day.slice(8, 10)) % 2 === 0 || day < '2026-08-20'
    return good
      ? { calories: 1300, trained: true, sleep_minutes: 450 }
      : { calories: 2300, trained: false, sleep_minutes: 360 }
  })

  test('ofrece lo que estuvo en sus días buenos y no en los malos, con evidencia', () => {
    const opts = planOptionsForWeekday(history, FRI, CTX, 'viernes')
    const keys = opts.map((o) => o.key)
    expect(keys).toContain('trained')
    expect(keys).toContain('sleep')
    expect(keys).not.toContain('protein')
    const good = onlyWeekday(history, FRI).filter((s) => s.calories! <= 1500).length
    expect(opts[0]!.evidence).toBe(`En ${good} de tus ${good} viernes en déficit`)
  })
  test('sin meta de calorías o con menos de 2 viernes buenos, nada', () => {
    expect(planOptionsForWeekday(history, FRI, { calorieTarget: null }, 'viernes')).toEqual([])
    expect(planOptionsForWeekday(history.slice(0, 7), FRI, CTX, 'viernes')).toEqual([])
  })
})
