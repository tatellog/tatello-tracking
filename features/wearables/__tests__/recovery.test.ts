import { mkSig } from '@/features/orbit/__tests__/signals.fixture'

import { NO_WEARABLE_FACTS, wearableDayFacts, workoutProvenanceLine } from '../recovery'

const DAY = '2026-09-22'

describe('wearableDayFacts', () => {
  it('sin fila → nada del reloj', () => {
    expect(wearableDayFacts(null)).toEqual(NO_WEARABLE_FACTS)
    expect(wearableDayFacts(undefined)).toEqual(NO_WEARABLE_FACTS)
  })

  it('entreno del reloj sin manual encima → workout con kcal, minutos y tipo', () => {
    const f = wearableDayFacts(
      mkSig(DAY, {
        trained: true,
        workout_source: 'wearable',
        workout_kcal: 342,
        workout_minutes: 45,
        workout_type: 'cardio',
      }),
    )
    expect(f.workout).toEqual({ kcal: 342, minutes: 45, type: 'cardio' })
  })

  it('entreno manual gana: el reloj no se reporta aunque haya kcal', () => {
    const f = wearableDayFacts(
      mkSig(DAY, { trained: true, workout_source: 'manual', workout_kcal: 300 }),
    )
    expect(f.workout).toBeNull()
  })

  it('kcal 0 o minutos 0 del reloj → null (nunca 0 como deuda)', () => {
    const f = wearableDayFacts(
      mkSig(DAY, {
        trained: true,
        workout_source: 'wearable',
        workout_kcal: 0,
        workout_minutes: 0,
      }),
    )
    expect(f.workout).toEqual({ kcal: null, minutes: null, type: null })
  })

  it('sueño del reloj (sleep_source wearable) → sleep', () => {
    const f = wearableDayFacts(mkSig(DAY, { sleep_minutes: 435, sleep_source: 'wearable' }))
    expect(f.sleep).toEqual({ minutes: 435 })
  })

  it('sueño manual (sleep_source manual) → no es del reloj', () => {
    const f = wearableDayFacts(mkSig(DAY, { sleep_minutes: 435, sleep_source: 'manual' }))
    expect(f.sleep).toBeNull()
  })

  it('view vieja (sin sleep_source): sin manual, el sueño de la view viene del reloj', () => {
    const f = wearableDayFacts(mkSig(DAY, { sleep_minutes: 400 }), { manualSleepMinutes: null })
    expect(f.sleep).toEqual({ minutes: 400 })
  })

  it('view vieja (sin sleep_source): con manual, el sueño es manual', () => {
    const f = wearableDayFacts(mkSig(DAY, { sleep_minutes: 400 }), { manualSleepMinutes: 400 })
    expect(f.sleep).toBeNull()
  })

  it('sin sueño en la view → nada, aunque no haya manual', () => {
    const f = wearableDayFacts(mkSig(DAY, {}), { manualSleepMinutes: null })
    expect(f.sleep).toBeNull()
  })
})

describe('wearableDayFacts · agua y pasos (spec §9)', () => {
  it('agua de Salud sin manual → water; con manual → null', () => {
    expect(
      wearableDayFacts(mkSig(DAY, { water_glasses: 6, water_source: 'wearable' })).water,
    ).toEqual({ glasses: 6 })
    expect(
      wearableDayFacts(mkSig(DAY, { water_glasses: 6, water_source: 'manual' })).water,
    ).toBeNull()
    // View vieja (sin water_source): no se asume nada del reloj.
    expect(wearableDayFacts(mkSig(DAY, { water_glasses: 6 })).water).toBeNull()
  })

  it('pasos del día → steps; 0 o null → null', () => {
    expect(wearableDayFacts(mkSig(DAY, { steps: 8432 })).steps).toBe(8432)
    expect(wearableDayFacts(mkSig(DAY, { steps: 0 })).steps).toBeNull()
    expect(wearableDayFacts(mkSig(DAY, {})).steps).toBeNull()
  })
})

describe('workoutProvenanceLine', () => {
  it('solo dice lo que el reloj trajo', () => {
    expect(workoutProvenanceLine({ kcal: 342, minutes: 45, type: 'cardio' })).toBe(
      'desde tu reloj · 45 min · ~342 kcal',
    )
    expect(workoutProvenanceLine({ kcal: null, minutes: 30, type: null })).toBe(
      'desde tu reloj · 30 min',
    )
    expect(workoutProvenanceLine({ kcal: null, minutes: null, type: null })).toBe('desde tu reloj')
  })
})
