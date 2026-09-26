import { mkSig } from '@/features/orbit/__tests__/signals.fixture'

import {
  NO_WEARABLE_FACTS,
  relativeSyncLabel,
  wearableDayFacts,
  wearableSignature,
} from '../recovery'

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

describe('relativeSyncLabel', () => {
  const now = new Date('2026-09-25T20:00:00Z')

  it('tiempo relativo, sin hora de reloj', () => {
    expect(relativeSyncLabel('2026-09-25T19:40:00Z', now)).toBe('hace un rato')
    expect(relativeSyncLabel('2026-09-25T17:30:00Z', now)).toBe('hace 2 h')
    expect(relativeSyncLabel('2026-09-24T21:00:00Z', now)).toBe('hace 23 h')
    expect(relativeSyncLabel('2026-09-24T10:00:00Z', now)).toBe('ayer')
  })

  it('null sin dato, en el futuro o hace más de dos días (una firma vieja miente)', () => {
    expect(relativeSyncLabel(null, now)).toBeNull()
    expect(relativeSyncLabel('2026-09-26T10:00:00Z', now)).toBeNull()
    expect(relativeSyncLabel('2026-09-20T10:00:00Z', now)).toBeNull()
  })
})

describe('wearableSignature (la firma bajo las filas de Hoy)', () => {
  const now = new Date('2026-09-25T20:00:00Z')

  it('null si nada vino del reloj', () => {
    expect(
      wearableSignature({ workout: false, sleep: false }, '2026-09-25T19:00:00Z', now),
    ).toBeNull()
  })

  it('dice una sola vez qué vino y hace cuánto', () => {
    expect(wearableSignature({ workout: true, sleep: true }, '2026-09-25T17:30:00Z', now)).toBe(
      'desde tu smartwatch · hace 2 h',
    )
    expect(wearableSignature({ workout: false, sleep: true }, '2026-09-25T19:40:00Z', now)).toBe(
      'sueño desde tu smartwatch · hace un rato',
    )
    expect(wearableSignature({ workout: true, sleep: false }, null, now)).toBe(
      'entreno desde tu smartwatch',
    )
  })
})
