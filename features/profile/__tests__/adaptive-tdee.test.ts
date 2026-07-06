import { adaptiveTdee } from '../adaptive-tdee'

import type { DailySignals } from '../../../supabase/functions/_shared/intelligence/types'

const TODAY = '2026-07-05'

function isoDaysAgo(n: number): string {
  const dt = new Date(2026, 6, 5 - n, 12)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

function sig(day: string, over: Partial<DailySignals> = {}): DailySignals {
  return {
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
    ...over,
  }
}

/** 28 días cerrados con kcal fijas + pesajes lineales entre startKg y endKg. */
function month(kcal: number, startKg: number, endKg: number): DailySignals[] {
  const rows: DailySignals[] = []
  for (let n = 28; n >= 1; n -= 1) {
    const t = (28 - n) / 27 // 0 en el día más viejo → 1 en ayer
    rows.push(
      sig(isoDaysAgo(n), {
        calories: kcal,
        weight_kg: Math.round((startKg + (endKg - startKg) * t) * 100) / 100,
      }),
    )
  }
  return rows
}

describe('adaptiveTdee', () => {
  it('peso estable → el gasto ES lo que come (el "+0.0 kg" explicado)', () => {
    const r = adaptiveTdee(month(1600, 67.1, 67.1), TODAY)
    expect(r).not.toBeNull()
    expect(r!.tdee).toBe(1600)
    expect(r!.deltaKg).toBeCloseTo(0, 1)
    expect(r!.quality).toBe('solida')
  })

  it('bajando de peso → gasto real por ENCIMA de lo comido', () => {
    // ~1.2 kg abajo entre los centros de racimo → +7700*1.2/span kcal/día.
    const r = adaptiveTdee(month(1600, 68.0, 66.8), TODAY)
    expect(r).not.toBeNull()
    expect(r!.tdee).toBeGreaterThan(1900)
    expect(r!.tdee).toBeLessThan(2200)
    expect(r!.deltaKg).toBeLessThan(0)
  })

  it('subiendo de peso → gasto real por DEBAJO de lo comido', () => {
    const r = adaptiveTdee(month(2200, 66.0, 66.9), TODAY)
    expect(r).not.toBeNull()
    expect(r!.tdee).toBeLessThan(2000)
  })

  it('HOY no cuenta (sus comidas siguen sumando)', () => {
    const rows = month(1600, 67, 67)
    rows.push(sig(TODAY, { calories: 200, weight_kg: 67 })) // día a medias
    const r = adaptiveTdee(rows, TODAY)
    expect(r!.kcalAvg).toBe(1600)
  })

  it('días de registro incompleto (<800 kcal) no envenenan el promedio', () => {
    const rows = month(1600, 67, 67)
    rows[3]!.calories = 300 // un yogurt suelto
    rows[9]!.calories = 150
    const r = adaptiveTdee(rows, TODAY)
    expect(r).not.toBeNull()
    expect(r!.kcalAvg).toBe(1600)
    expect(r!.dataDays).toBe(26)
  })

  it('null con menos de 14 días creíbles (jamás inventa)', () => {
    const rows = month(1600, 67, 67).slice(0, 10)
    expect(adaptiveTdee(rows, TODAY)).toBeNull()
  })

  it('null sin pesajes en ALGÚN extremo de la ventana', () => {
    const rows = month(1600, 67, 67).map((s) =>
      // Solo pesajes viejos: los últimos 10 días sin báscula.
      s.day! >= isoDaysAgo(10) ? { ...s, weight_kg: null } : s,
    )
    expect(adaptiveTdee(rows, TODAY)).toBeNull()
  })

  it('resultado absurdo se acota y baja a calidad temprana', () => {
    // Caída de peso imposible (12 kg en un mes con 1600 kcal) → clamp techo.
    const r = adaptiveTdee(month(1600, 74, 62), TODAY)
    expect(r).not.toBeNull()
    expect(r!.tdee).toBeLessThanOrEqual(4500)
    expect(r!.quality).toBe('temprana')
  })

  it('redondea a decenas (observación, no cirugía)', () => {
    const r = adaptiveTdee(month(1607, 67, 67), TODAY)
    expect(r!.tdee % 10).toBe(0)
  })
})
