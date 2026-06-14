import {
  detectProteinConsistency,
  detectTrainingConsistency,
  detectSleepConsistency,
  PROTEIN_CONSISTENT_MIN_DAYS,
  TRAINING_CONSISTENT_MIN_DAYS,
  SLEEP_CONSISTENT_MIN_DAYS,
  SLEEP_ENOUGH_MIN,
  WINDOW_DAYS,
} from '../consistency'
import type { ProteinDay, SleepNight } from '../consistency'

// nowMs fijo: 2026-05-28T15:00:00 UTC (mismo que el test de logic.ts existente)
const NOW_MS = new Date('2026-05-28T15:00:00').getTime()

// Helpers: produce fechas YYYY-MM-DD relativas a NOW_MS
function dateKey(daysAgo: number): string {
  const d = new Date(NOW_MS - daysAgo * 24 * 60 * 60 * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Fecha claramente fuera de la ventana (8 días atrás)
const OLD = dateKey(8)

// --- detectProteinConsistency ---

describe('detectProteinConsistency', () => {
  function proteinDay(daysAgo: number, met: boolean): ProteinDay {
    return {
      date: dateKey(daysAgo),
      proteinG: met ? 100 : 40,
      targetG: 100,
    }
  }

  test('detecta cuando se cumple el objetivo en 4+ días distintos (happy path)', () => {
    const days = [0, 1, 2, 3].map((d) => proteinDay(d, true))

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(PROTEIN_CONSISTENT_MIN_DAYS)
    expect(result.windowDays).toBe(WINDOW_DAYS)
  })

  test('no detecta cuando solo se cumplen 3 días (borderline: min-1)', () => {
    const days = [0, 1, 2].map((d) => proteinDay(d, true))

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(PROTEIN_CONSISTENT_MIN_DAYS - 1)
  })

  test('detecta con exactamente el mínimo requerido (borderline: exactamente min)', () => {
    const days = Array.from({ length: PROTEIN_CONSISTENT_MIN_DAYS }, (_, i) => proteinDay(i, true))

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(PROTEIN_CONSISTENT_MIN_DAYS)
  })

  test('detecta con 7/7 días (extreme: toda la ventana)', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => proteinDay(d, true))

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(7)
  })

  test('ignora días fuera de la ventana de 7 días', () => {
    const inWindow = [0, 1, 2].map((d) => proteinDay(d, true))
    const outOfWindow: ProteinDay[] = [{ date: OLD, proteinG: 100, targetG: 100 }]

    const result = detectProteinConsistency([...inWindow, ...outOfWindow], NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(3)
  })

  test('entradas duplicadas del mismo día no inflan el conteo', () => {
    // 3 días únicos que cumplen, más una entrada duplicada del día 0
    const days: ProteinDay[] = [
      { date: dateKey(0), proteinG: 100, targetG: 100 },
      { date: dateKey(0), proteinG: 110, targetG: 100 }, // duplicado
      { date: dateKey(1), proteinG: 100, targetG: 100 },
      { date: dateKey(2), proteinG: 100, targetG: 100 },
    ]

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.count).toBe(3)
    expect(result.detected).toBe(false)
  })

  test('no cuenta días con targetG = 0 (objetivo no configurado)', () => {
    const days: ProteinDay[] = [
      { date: dateKey(0), proteinG: 100, targetG: 0 },
      { date: dateKey(1), proteinG: 100, targetG: 0 },
      { date: dateKey(2), proteinG: 100, targetG: 0 },
      { date: dateKey(3), proteinG: 100, targetG: 0 },
    ]

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(0)
  })

  test('no cuenta cuando la proteína no alcanza el objetivo', () => {
    const days = [0, 1, 2, 3].map((d) => proteinDay(d, false))

    const result = detectProteinConsistency(days, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(0)
  })

  test('retorna count 0 con array vacío', () => {
    const result = detectProteinConsistency([], NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(0)
  })
})

// --- detectTrainingConsistency ---

describe('detectTrainingConsistency', () => {
  test('detecta cuando hay 3+ días de entrenamiento distintos (happy path)', () => {
    const dates = [dateKey(0), dateKey(2), dateKey(4)]

    const result = detectTrainingConsistency(dates, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(TRAINING_CONSISTENT_MIN_DAYS)
    expect(result.windowDays).toBe(WINDOW_DAYS)
  })

  test('no detecta con 2 días (borderline: min-1)', () => {
    const dates = [dateKey(0), dateKey(1)]

    const result = detectTrainingConsistency(dates, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(TRAINING_CONSISTENT_MIN_DAYS - 1)
  })

  test('detecta con exactamente el mínimo requerido (borderline: exactamente min)', () => {
    const dates = Array.from({ length: TRAINING_CONSISTENT_MIN_DAYS }, (_, i) => dateKey(i))

    const result = detectTrainingConsistency(dates, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(TRAINING_CONSISTENT_MIN_DAYS)
  })

  test('detecta con 7/7 días (extreme: toda la ventana)', () => {
    const dates = [0, 1, 2, 3, 4, 5, 6].map(dateKey)

    const result = detectTrainingConsistency(dates, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(7)
  })

  test('ignora fechas fuera de la ventana de 7 días', () => {
    const dates = [dateKey(0), dateKey(1), OLD]

    const result = detectTrainingConsistency(dates, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(2)
  })

  test('fechas duplicadas del mismo día no inflan el conteo', () => {
    // 2 días únicos + misma fecha duplicada
    const dates = [dateKey(0), dateKey(0), dateKey(1)]

    const result = detectTrainingConsistency(dates, NOW_MS)

    expect(result.count).toBe(2)
    expect(result.detected).toBe(false)
  })

  test('retorna count 0 con array vacío', () => {
    const result = detectTrainingConsistency([], NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(0)
  })
})

// --- detectSleepConsistency ---

describe('detectSleepConsistency', () => {
  function sleepNight(daysAgo: number, minutes: number): SleepNight {
    return { date: dateKey(daysAgo), minutes }
  }

  test('detecta cuando hay 4+ noches con sueño suficiente (happy path)', () => {
    const nights = [0, 1, 2, 3].map((d) => sleepNight(d, SLEEP_ENOUGH_MIN))

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(SLEEP_CONSISTENT_MIN_DAYS)
    expect(result.windowDays).toBe(WINDOW_DAYS)
  })

  test('no detecta con 3 noches (borderline: min-1)', () => {
    const nights = [0, 1, 2].map((d) => sleepNight(d, SLEEP_ENOUGH_MIN))

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(SLEEP_CONSISTENT_MIN_DAYS - 1)
  })

  test('detecta con exactamente el mínimo requerido (borderline: exactamente min)', () => {
    const nights = Array.from({ length: SLEEP_CONSISTENT_MIN_DAYS }, (_, i) =>
      sleepNight(i, SLEEP_ENOUGH_MIN),
    )

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(SLEEP_CONSISTENT_MIN_DAYS)
  })

  test('detecta con 7/7 noches (extreme: toda la ventana)', () => {
    const nights = [0, 1, 2, 3, 4, 5, 6].map((d) => sleepNight(d, SLEEP_ENOUGH_MIN + 30))

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(7)
  })

  test('ignora noches fuera de la ventana de 7 días', () => {
    const inWindow = [0, 1, 2].map((d) => sleepNight(d, SLEEP_ENOUGH_MIN))
    const outOfWindow: SleepNight = { date: OLD, minutes: SLEEP_ENOUGH_MIN }

    const result = detectSleepConsistency([...inWindow, outOfWindow], NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(3)
  })

  test('entradas duplicadas del mismo día no inflan el conteo', () => {
    const nights: SleepNight[] = [
      { date: dateKey(0), minutes: SLEEP_ENOUGH_MIN },
      { date: dateKey(0), minutes: SLEEP_ENOUGH_MIN + 60 }, // duplicado
      { date: dateKey(1), minutes: SLEEP_ENOUGH_MIN },
      { date: dateKey(2), minutes: SLEEP_ENOUGH_MIN },
    ]

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.count).toBe(3)
    expect(result.detected).toBe(false)
  })

  test('no cuenta noches por debajo del umbral de minutos', () => {
    // 389 minutos = 6h29m → un minuto menos que el umbral
    const nights = [0, 1, 2, 3].map((d) => sleepNight(d, SLEEP_ENOUGH_MIN - 1))

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(0)
  })

  test('límite inclusivo: exactamente SLEEP_ENOUGH_MIN minutos cuenta', () => {
    const nights = [0, 1, 2, 3].map((d) => sleepNight(d, SLEEP_ENOUGH_MIN))

    const result = detectSleepConsistency(nights, NOW_MS)

    expect(result.detected).toBe(true)
    expect(result.count).toBe(4)
  })

  test('retorna count 0 con array vacío', () => {
    const result = detectSleepConsistency([], NOW_MS)

    expect(result.detected).toBe(false)
    expect(result.count).toBe(0)
  })
})
