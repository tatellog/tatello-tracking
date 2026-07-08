import { buildPeriodContext, SLEEP_ENOUGH_MINUTES, type ContextRow } from '../context'
import { mkSig } from './signals.fixture'

const TARGET = 1500

/** mkSig produce una fila daily_signals completa; el context lee un superset
 *  con workout_kcal opcional. Helper para inyectar la kcal del wearable. */
function row(day: string, o: Partial<ContextRow> = {}): ContextRow {
  return mkSig(day, o) as ContextRow
}

describe('buildPeriodContext — nutrición', () => {
  it('promedia solo días con comida y cuenta déficit/superávit correctamente', () => {
    const signals = [
      row('2026-07-01', { calories: 1200, protein_g: 120, meal_count: 3 }), // déficit
      row('2026-07-02', { calories: 1450, protein_g: 100, meal_count: 3 }), // déficit
      row('2026-07-03', { calories: 1800, protein_g: 90, meal_count: 3 }), // superávit
      row('2026-07-04', { sleep_minutes: 420 }), // sin comida → no cuenta en avg ni denominador
    ]
    const ctx = buildPeriodContext({ period: 'week', signals, calorieTarget: TARGET })
    expect(ctx.nutrition.avgCalories).toBe(round3(1200, 1450, 1800))
    expect(ctx.nutrition.avgProtein).toBe(round3(120, 100, 90))
    expect(ctx.nutrition.deficitDays).toBe(2)
    expect(ctx.nutrition.surplusDays).toBe(1)
    expect(ctx.nutrition.daysLogged).toBe(3)
  })

  it('un día muy bajo el piso NO es déficit NI superávit (línea roja)', () => {
    // 600 < 0.6×1500 = 900 → ni déficit sano ni superávit.
    const ctx = buildPeriodContext({
      period: 'day',
      signals: [row('2026-07-01', { calories: 600, meal_count: 1 })],
      calorieTarget: TARGET,
    })
    expect(ctx.nutrition.deficitDays).toBe(0)
    expect(ctx.nutrition.surplusDays).toBe(0)
    expect(ctx.nutrition.daysLogged).toBe(1)
  })
})

describe('buildPeriodContext — actividad y sueño', () => {
  it('workoutDays y promedio de kcal solo sobre entrenos con dato del reloj', () => {
    const signals = [
      row('2026-07-01', { trained: true, workout_kcal: 300 }),
      row('2026-07-02', { trained: true, workout_kcal: 400 }),
      row('2026-07-03', { trained: true }), // manual sin kcal → no baja el promedio
      row('2026-07-04', { trained: false }),
    ]
    const ctx = buildPeriodContext({ period: 'week', signals, calorieTarget: TARGET })
    expect(ctx.activity.workoutDays).toBe(3)
    expect(ctx.activity.workoutKcalAvg).toBe(350)
  })

  it('sueño: promedio y días con 7h+ (umbral honesto)', () => {
    const signals = [
      row('2026-07-01', { sleep_minutes: 480 }), // 8h ✓
      row('2026-07-02', { sleep_minutes: SLEEP_ENOUGH_MINUTES }), // 7h justo ✓
      row('2026-07-03', { sleep_minutes: 360 }), // 6h ✗
    ]
    const ctx = buildPeriodContext({ period: 'week', signals, calorieTarget: TARGET })
    expect(ctx.sleep.avgSleepMinutes).toBe(round3(480, 420, 360))
    expect(ctx.sleep.daysAbove7h).toBe(2)
  })
})

describe('buildPeriodContext — cuerpo', () => {
  it('weightChange = último menos primero; latest = el más reciente', () => {
    const signals = [
      row('2026-07-01', { weight_kg: 70.5 }),
      row('2026-07-15', { weight_kg: 69.2 }),
      row('2026-07-31', { weight_kg: 68.4 }),
    ]
    const ctx = buildPeriodContext({ period: 'month', signals, calorieTarget: TARGET })
    expect(ctx.body.latestWeightKg).toBe(68.4)
    expect(ctx.body.weightChangeKg).toBe(-2.1)
  })

  it('un solo pesaje → latest sí, change null (no se inventa una tendencia)', () => {
    const ctx = buildPeriodContext({
      period: 'month',
      signals: [row('2026-07-10', { weight_kg: 70 })],
      calorieTarget: TARGET,
    })
    expect(ctx.body.latestWeightKg).toBe(70)
    expect(ctx.body.weightChangeKg).toBeNull()
  })
})

describe('buildPeriodContext — rango y vacío', () => {
  it('dateRange = min..max de los días', () => {
    const ctx = buildPeriodContext({
      period: 'month',
      signals: [
        row('2026-07-31', { calories: 1400, meal_count: 1 }),
        row('2026-07-01', { calories: 1400, meal_count: 1 }),
      ],
      calorieTarget: TARGET,
    })
    expect(ctx.dateRange).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })

  it('periodo sin filas → todo null/0, patterns vacío, sin vsPrevious', () => {
    const ctx = buildPeriodContext({ period: 'week', signals: [], calorieTarget: TARGET })
    expect(ctx.dateRange).toBeNull()
    expect(ctx.nutrition.avgCalories).toBeNull()
    expect(ctx.nutrition.deficitDays).toBe(0)
    expect(ctx.body.weightChangeKg).toBeNull()
    expect(ctx.patterns).toEqual([])
    expect(ctx.vsPrevious).toBeUndefined()
  })
})

describe('buildPeriodContext — comparación vs periodo anterior', () => {
  it('deltas de las métricas clave contra el periodo previo', () => {
    const current = [
      row('2026-07-08', {
        calories: 1400,
        protein_g: 120,
        meal_count: 3,
        trained: true,
        sleep_minutes: 450,
      }),
      row('2026-07-09', {
        calories: 1300,
        protein_g: 110,
        meal_count: 3,
        trained: true,
        sleep_minutes: 420,
      }),
    ]
    const previous = [
      row('2026-07-01', {
        calories: 1600,
        protein_g: 90,
        meal_count: 3,
        trained: false,
        sleep_minutes: 400,
      }),
      row('2026-07-02', {
        calories: 1700,
        protein_g: 100,
        meal_count: 3,
        trained: false,
        sleep_minutes: 380,
      }),
    ]
    const ctx = buildPeriodContext({
      period: 'week',
      signals: current,
      calorieTarget: TARGET,
      previous,
    })
    expect(ctx.vsPrevious).toBeDefined()
    // avg cal: 1350 vs 1650 → -300
    expect(ctx.vsPrevious!.avgCaloriesDelta).toBe(-300)
    // déficit: 2 (ambos ≤1500 y ≥900) vs 0 → +2
    expect(ctx.vsPrevious!.deficitDaysDelta).toBe(2)
    // entrenos: 2 vs 0 → +2
    expect(ctx.vsPrevious!.workoutDaysDelta).toBe(2)
    // sueño: 435 vs 390 → +45
    expect(ctx.vsPrevious!.avgSleepMinutesDelta).toBe(45)
  })
})

/** Promedio redondeado de 3 valores (helper de aserción). */
function round3(a: number, b: number, c: number): number {
  return Math.round((a + b + c) / 3)
}
