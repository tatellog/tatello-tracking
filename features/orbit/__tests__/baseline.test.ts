import { BASELINE_MIN_DAYS, weekBaseline, weekBaselineObservations } from '../baseline'
import { mkSig } from './signals.fixture'

describe('weekBaseline · esta semana vs tu costumbre', () => {
  const WEEK_START = '2026-06-22' // lunes de la semana en curso
  // Historial previo: 20 días a 450 min (antes del lunes).
  const priorHistory = Array.from({ length: 20 }, (_, i) => {
    const d = new Date('2026-06-01T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i) // 2026-06-01 … 2026-06-20 (todos < WEEK_START)
    return mkSig(d.toISOString().slice(0, 10), { sleep_minutes: 450 })
  })

  it('null cuando la semana tiene menos de 3 registros', () => {
    const week = [
      mkSig('2026-06-22', { sleep_minutes: 300 }),
      mkSig('2026-06-23', { sleep_minutes: 300 }),
    ]
    expect(weekBaseline('sueno', week, priorHistory, WEEK_START)).toBeNull()
  })

  it('null cuando el historial previo no llega a BASELINE_MIN_DAYS', () => {
    const week = [
      mkSig('2026-06-22', { sleep_minutes: 300 }),
      mkSig('2026-06-23', { sleep_minutes: 300 }),
      mkSig('2026-06-24', { sleep_minutes: 300 }),
    ]
    const thin = priorHistory.slice(0, BASELINE_MIN_DAYS - 1)
    expect(weekBaseline('sueno', week, thin, WEEK_START)).toBeNull()
  })

  it('"como sueles" cuando el promedio de la semana cae en la banda', () => {
    const week = [
      mkSig('2026-06-22', { sleep_minutes: 460 }),
      mkSig('2026-06-23', { sleep_minutes: 440 }),
      mkSig('2026-06-24', { sleep_minutes: 450 }),
    ]
    expect(weekBaseline('sueno', week, priorHistory, WEEK_START)!.status).toBe('typical')
  })

  it('"menos que de costumbre" cuando el promedio de la semana baja de la banda', () => {
    const week = [
      mkSig('2026-06-22', { sleep_minutes: 320 }),
      mkSig('2026-06-23', { sleep_minutes: 330 }),
      mkSig('2026-06-24', { sleep_minutes: 340 }),
    ]
    expect(weekBaseline('sueno', week, priorHistory, WEEK_START)!.status).toBe('lower')
  })

  it('weekBaselineObservations devuelve solo las honestas', () => {
    const week = [
      mkSig('2026-06-22', { sleep_minutes: 320, energy: 3 }),
      mkSig('2026-06-23', { sleep_minutes: 330, energy: 3 }),
      mkSig('2026-06-24', { sleep_minutes: 340, energy: 3 }),
    ]
    // energía no tiene historial previo → solo sueño debe salir.
    const out = weekBaselineObservations(week, priorHistory, WEEK_START)
    expect(out.map((o) => o.key)).toEqual(['sueno'])
    expect(out[0]!.status).toBe('lower')
  })
})
