import type { BodyMeasurement } from '@/features/brief/api'
import type { DailySignals } from '@/features/orbit/api'

import { compareHistory } from '../logic'

/** DailySignals mínimo para un día. */
const sig = (day: string, o: Partial<DailySignals> = {}): DailySignals =>
  ({
    day,
    sleep_minutes: null,
    sleep_quality: null,
    energy: null,
    motivation: null,
    stress: null,
    mood: null,
    protein_g: null,
    calories: null,
    meal_count: null,
    trained: null,
    workout_type: null,
    weight_kg: null,
    water_glasses: null,
    rested: null,
    on_period: null,
    ...o,
  }) as DailySignals

/** Un día YYYY-MM-DD a partir de 2026-07-31, `back` días atrás. */
const day = (back: number) => {
  const dt = new Date(2026, 6, 31 - back, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const CTX = { today: '2026-07-31', calorieTarget: 1500, proteinTarget: 120, windowDays: 10 }

describe('compareHistory — comparación 30v30 de hábitos', () => {
  it('cuenta entrenos y registro por ventana, con dirección', () => {
    // Ventana actual (últimos 10 días): 3 entrenos, 4 días con comida.
    // Ventana previa (10 antes): 1 entreno, 2 días con comida.
    const signals: DailySignals[] = [
      // actual
      sig(day(1), { trained: true, meal_count: 3 }),
      sig(day(3), { trained: true, meal_count: 2 }),
      sig(day(5), { trained: true }),
      sig(day(7), { meal_count: 1 }),
      // previa
      sig(day(12), { trained: true, meal_count: 4 }),
      sig(day(15), { meal_count: 2 }),
    ]
    const r = compareHistory(signals, [], CTX)
    const workouts = r.metrics.find((m) => m.key === 'workouts')!
    expect(workouts.current).toBe(3)
    expect(workouts.previous).toBe(1)
    expect(workouts.direction).toBe('up')
    // Con comida en la ventana actual: day1, day3, day7 (day5 solo entrenó) = 3.
    const logging = r.metrics.find((m) => m.key === 'logging')!
    expect(logging.current).toBe(3)
    expect(logging.previous).toBe(2)
  })

  it('déficit usa la regla canónica; proteína cuenta días en meta', () => {
    const signals: DailySignals[] = [
      sig(day(1), { calories: 1200, protein_g: 130 }), // déficit ✓ + proteína ✓
      sig(day(2), { calories: 700 }), // bajo el piso → NO déficit
      sig(day(3), { calories: 1400, protein_g: 100 }), // déficit ✓, proteína ✗
    ]
    const r = compareHistory(signals, [], CTX)
    expect(r.metrics.find((m) => m.key === 'deficit')!.current).toBe(2)
    expect(r.metrics.find((m) => m.key === 'protein')!.current).toBe(1)
  })

  it('omite proteína/déficit si no hay meta (no inventa)', () => {
    const signals = [sig(day(1), { calories: 1200, protein_g: 130 })]
    const r = compareHistory(signals, [], { ...CTX, calorieTarget: null, proteinTarget: null })
    expect(r.metrics.find((m) => m.key === 'deficit')).toBeUndefined()
    expect(r.metrics.find((m) => m.key === 'protein')).toBeUndefined()
  })

  it('compara peso: última medición vs la más cercana a hace 10 días', () => {
    const meas = (iso: string, kg: number): BodyMeasurement =>
      ({ id: iso, measured_at: iso, weight_kg: kg }) as unknown as BodyMeasurement
    const measurements = [meas('2026-07-21T12:00:00Z', 80), meas('2026-07-31T12:00:00Z', 78.4)]
    const r = compareHistory([], measurements, CTX)
    const w = r.metrics.find((m) => m.key === 'weight')!
    expect(w.current).toBe(78.4)
    expect(w.previous).toBe(80)
    expect(w.delta).toBe(-1.6)
    expect(w.direction).toBe('down')
  })

  it('sin ≥2 mediciones no hay card de peso', () => {
    const r = compareHistory([], [], CTX)
    expect(r.metrics.find((m) => m.key === 'weight')).toBeUndefined()
  })
})
