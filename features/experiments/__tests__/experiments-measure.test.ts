import { mkSig } from '../../orbit/__tests__/signals.fixture'
import {
  computeMetricRate,
  measureExperiment,
  RESULT_MARGIN,
  type ExperimentMetric,
} from '../logic'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }

/** N días desde 2026-07-01 con override por día. */
function days(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push(mkSig(`2026-07-${String(i + 1).padStart(2, '0')}`, override(i)))
  }
  return out
}

describe('computeMetricRate — cuenta días evaluables que cumplen (T-B2)', () => {
  it('deficit_days: solo días con comida y con target son evaluables', () => {
    const signals = days(10, (i) => ({ calories: i < 6 ? 1200 : i < 8 ? 1900 : null }))
    // 8 días con comida (evaluable), 6 en déficit.
    const r = computeMetricRate('deficit_days', signals, CTX)
    expect(r.daysMeasured).toBe(8)
    expect(r.hitDays).toBe(6)
    expect(r.rate).toBeCloseTo(6 / 8)
  })

  it('deficit_days sin calorieTarget: nada evaluable → rate 0', () => {
    const signals = days(6, () => ({ calories: 1200 }))
    expect(computeMetricRate('deficit_days', signals, {}).daysMeasured).toBe(0)
  })

  it('workout_days: cada día registrado es evaluable; cumple si entrenó', () => {
    const signals = days(10, (i) => ({ calories: 1300, trained: i < 4 }))
    const r = computeMetricRate('workout_days', signals, CTX)
    expect(r.daysMeasured).toBe(10)
    expect(r.hitDays).toBe(4)
  })

  it('days_slept_7h: cumple con ≥420 min', () => {
    const signals = days(8, (i) => ({ sleep_minutes: i < 5 ? 430 : 400 }))
    const r = computeMetricRate('days_slept_7h', signals, CTX)
    expect(r.daysMeasured).toBe(8)
    expect(r.hitDays).toBe(5)
  })
})

describe('measureExperiment — el motor decide el resultado (T-B2)', () => {
  const plan = (
    metric: ExperimentMetric,
    direction: 'increase' | 'decrease' | 'maintain' = 'increase',
  ) => ({
    metric,
    direction,
    durationDays: 14,
  })

  it('confirmada: la ventana supera la línea base por ≥ el margen', () => {
    // 14 días, 12 en déficit (rate .857) vs baseline .4 → confirmada.
    const signals = days(14, (i) => ({ calories: i < 12 ? 1200 : 1900 }))
    const m = measureExperiment(plan('deficit_days'), signals, { ...CTX, baselineRate: 0.4 })
    expect(m.status).toBe('confirmed')
    expect(m.hitDays).toBe(12)
    expect(m.daysMeasured).toBe(14)
    expect(m.windowRate - m.baselineRate).toBeGreaterThanOrEqual(RESULT_MARGIN)
  })

  it('descartada: la ventana cae por debajo de la base por ≥ el margen', () => {
    const signals = days(14, (i) => ({ calories: i < 3 ? 1200 : 1900 })) // rate ~.21
    const m = measureExperiment(plan('deficit_days'), signals, { ...CTX, baselineRate: 0.7 })
    expect(m.status).toBe('discarded')
  })

  it('inconclusa: el cambio es menor que el margen', () => {
    const signals = days(14, (i) => ({ calories: i < 7 ? 1200 : 1900 })) // rate .5
    const m = measureExperiment(plan('deficit_days'), signals, { ...CTX, baselineRate: 0.45 })
    expect(m.status).toBe('inconclusive')
  })

  it('inconclusa por muestra insuficiente (pocos días evaluables), sin juzgar', () => {
    // Solo 3 días con comida en toda la ventana → por debajo del mínimo.
    const signals = days(14, (i) => ({ calories: i < 3 ? 1200 : null }))
    const m = measureExperiment(plan('deficit_days'), signals, { ...CTX, baselineRate: 0.2 })
    expect(m.status).toBe('inconclusive')
    expect(m.daysMeasured).toBe(3)
  })

  it('inconclusa si la línea base tiene muestra insuficiente (bug #1)', () => {
    // Ventana clarísima (12/14 en déficit) pero baseline con solo 2 días medidos:
    // sin base no se puede declarar "mejora" aunque la ventana se vea bien.
    const signals = days(14, (i) => ({ calories: i < 12 ? 1200 : 1900 }))
    const m = measureExperiment(plan('deficit_days'), signals, {
      ...CTX,
      baselineRate: 0,
      baselineDaysMeasured: 2,
    })
    expect(m.status).toBe('inconclusive')
  })

  it('con base suficiente (≥4 días) sí juzga', () => {
    const signals = days(14, (i) => ({ calories: i < 12 ? 1200 : 1900 }))
    const m = measureExperiment(plan('deficit_days'), signals, {
      ...CTX,
      baselineRate: 0.3,
      baselineDaysMeasured: 10,
    })
    expect(m.status).toBe('confirmed')
  })

  it('direction maintain: confirma si se sostiene dentro del margen', () => {
    const signals = days(14, (i) => ({ calories: i < 8 ? 1200 : 1900 })) // rate ~.57
    const m = measureExperiment(plan('deficit_days', 'maintain'), signals, {
      ...CTX,
      baselineRate: 0.55,
    })
    expect(m.status).toBe('confirmed')
  })
})
