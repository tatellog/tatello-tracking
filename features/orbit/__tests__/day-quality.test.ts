import { adaptiveTdee } from '@/features/profile/adaptive-tdee'

import { COMPLETE_DAY_MIN_KCAL, dayQuality } from '../day-quality'

/*
 * V-09 · la definición única de "día completo / parcial / vacío".
 * Es una UNIFICACIÓN, no un cambio: el umbral es el histórico del TDEE
 * adaptativo (800), y el test de paridad de abajo lo asegura.
 */

describe('dayQuality', () => {
  it('sin comida (null o 0) → vacío', () => {
    expect(dayQuality({ calories: null })).toBe('vacio')
    expect(dayQuality({ calories: 0 })).toBe('vacio')
  })

  it('con comida pero bajo el umbral → parcial (un yogurt suelto)', () => {
    expect(dayQuality({ calories: 1 })).toBe('parcial')
    expect(dayQuality({ calories: 420 })).toBe('parcial')
    expect(dayQuality({ calories: COMPLETE_DAY_MIN_KCAL - 1 })).toBe('parcial')
  })

  it('desde el umbral → completo', () => {
    expect(dayQuality({ calories: COMPLETE_DAY_MIN_KCAL })).toBe('completo')
    expect(dayQuality({ calories: 2400 })).toBe('completo')
  })

  it('el umbral sigue siendo el histórico del TDEE (800) — unificar no es cambiar', () => {
    expect(COMPLETE_DAY_MIN_KCAL).toBe(800)
  })
})

describe('paridad con adaptive-tdee', () => {
  const signal = (day: string, calories: number | null, weight_kg: number | null = null) => ({
    day,
    calories,
    weight_kg,
    sleep_minutes: null,
    sleep_quality: null,
    energy: null,
    motivation: null,
    stress: null,
    mood: null,
    protein_g: null,
    meal_count: null,
    trained: null,
    workout_type: null,
    water_glasses: null,
    rested: null,
    on_period: null,
  })

  it('los días parciales siguen sin alimentar el promedio del TDEE', () => {
    // 28 días: 14 completos (1800 kcal) + 14 parciales (400 kcal) +
    // pesajes en ambos extremos. Si un parcial se colara al promedio,
    // kcalAvg bajaría de 1800.
    const today = '2026-07-23'
    const signals = []
    for (let i = 1; i <= 28; i++) {
      const d = new Date(2026, 6, 23 - i, 12)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const complete = i % 2 === 0
      const weigh = i <= 3 || i >= 26 ? 70 - i * 0.02 : null
      signals.push(signal(iso, complete ? 1800 : 400, weigh))
    }
    const tdee = adaptiveTdee(signals, today)
    expect(tdee).not.toBeNull()
    expect(tdee!.kcalAvg).toBe(1800)
    expect(tdee!.dataDays).toBe(14)
  })
})
