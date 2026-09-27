import { dataMaturity, stageFor } from '../maturity'
import { addDays, mkSig } from './signals.fixture'

const BASE = '2026-06-01'
const days = (n: number, o: (i: number) => Parameters<typeof mkSig>[1]) =>
  Array.from({ length: n }, (_, i) => mkSig(addDays(BASE, i), o(i)))

describe('stageFor', () => {
  it('etapas por días con datos, no por calendario', () => {
    expect([0, 2, 3, 7, 8, 20, 21, 59, 60, 179, 180].map(stageFor)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
    ])
  })
})

describe('dataMaturity', () => {
  it('sin datos: etapa 0', () => {
    expect(dataMaturity([]).stage).toBe(0)
  })

  it('solo cuentan los días de comida COMPLETOS (un parcial no madura el déficit)', () => {
    const m = dataMaturity(days(10, () => ({ meal_count: 1, calories: 400 })))
    expect(m.days.food).toBe(0)
    expect(m.deficitReady).toBe(false)
  })

  it('un mes de comidas completas: etapa 3 con déficit listo', () => {
    const m = dataMaturity(days(25, () => ({ meal_count: 3, calories: 1500 })))
    expect(m.days.food).toBe(25)
    expect(m.stage).toBe(3)
    expect(m.deficitReady).toBe(true)
    expect(m.deficitBlockedByFood).toBe(false)
  })

  it('solo reloj, sin comidas: maduran sueño y movimiento, el déficit queda bloqueado', () => {
    const m = dataMaturity(days(30, () => ({ sleep_minutes: 420, steps: 6000 })))
    expect(m.stage).toBe(3)
    expect(m.days.food).toBe(0)
    expect(m.deficitReady).toBe(false)
    expect(m.deficitBlockedByFood).toBe(true)
  })

  it('cada dimensión madura por separado: la etapa es la de la más madura', () => {
    const m = dataMaturity(
      days(12, (i) => ({
        sleep_minutes: 420,
        ...(i < 4 ? { meal_count: 2, calories: 1500 } : {}),
      })),
    )
    expect(m.days).toEqual({ food: 4, sleep: 12, movement: 0 })
    expect(m.stage).toBe(2)
    expect(m.deficitBlockedByFood).toBe(true)
  })

  it('un día repetido no cuenta doble', () => {
    const d = mkSig(BASE, { meal_count: 2, calories: 1500 })
    expect(dataMaturity([d, d, d]).days.food).toBe(1)
  })
})
