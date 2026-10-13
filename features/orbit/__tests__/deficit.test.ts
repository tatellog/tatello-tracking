import { monthCalendar } from '../month-built'
import { DEFICIT_FLOOR_RATIO, isDeficitDay } from '../deficit'
import { tuDiaModel } from '@/features/tabs/tu-dia'

import { mkSig } from './signals.fixture'

/*
 * ST-002 · la regla única de "día en déficit sano" (deficit.ts) no tenía
 * test propio. Fija la banda [0.6 × meta, meta] y la semántica de dato
 * desconocido: calorías null (o 0) NUNCA son déficit, aunque haya comidas.
 */
describe('isDeficitDay', () => {
  const T = 1500

  it('dentro de la banda sana → déficit', () => {
    expect(isDeficitDay(T * DEFICIT_FLOOR_RATIO, T)).toBe(true)
    expect(isDeficitDay(1200, T)).toBe(true)
    expect(isDeficitDay(T, T)).toBe(true)
  })

  it('debajo del piso o sobre la meta → no', () => {
    expect(isDeficitDay(T * DEFICIT_FLOOR_RATIO - 1, T)).toBe(false)
    expect(isDeficitDay(150, T)).toBe(false)
    expect(isDeficitDay(T + 1, T)).toBe(false)
  })

  it('dato desconocido (null) o cero → no (faltar ≠ ayunar)', () => {
    expect(isDeficitDay(null, T)).toBe(false)
    expect(isDeficitDay(undefined, T)).toBe(false)
    expect(isDeficitDay(0, T)).toBe(false)
  })

  it('sin meta válida → no hay déficit que afirmar', () => {
    expect(isDeficitDay(1200, null)).toBe(false)
    expect(isDeficitDay(1200, 0)).toBe(false)
    expect(isDeficitDay(1200, -100)).toBe(false)
  })
})

describe('comidas registradas sin calorías (meal_count > 0, calories null)', () => {
  it('el calendario no lo pinta "poco" ni lo cuenta en el denominador', () => {
    const cal = monthCalendar(
      [
        mkSig('2026-06-01', { meal_count: 2, calories: 1400 }),
        mkSig('2026-06-02', { meal_count: 2, calories: null }),
      ],
      { today: '2026-06-15', calorieTarget: 1800 },
    )!
    expect(cal.days[1]!.status).toBe('none')
    expect(cal.dataDays).toBe(1)
    expect(cal.hasLow).toBe(false)
  })

  it('Hoy no afirma déficit con 0 kcal conocidas aunque haya comidas', () => {
    const m = tuDiaModel({
      consumedCalories: 0,
      targetCalories: 1500,
      mealCount: 2,
      hour: 13,
      weeklyReadingReady: false,
    })
    expect(m == null || (m.kind === 'day' && m.status !== 'deficit')).toBe(true)
  })
})
