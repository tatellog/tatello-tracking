import type { CalendarDay } from '@/features/tabs/components/calendar/logic'

import {
  buildConstanciaMonth,
  foodSummary,
  monthKeyBack,
  sleepLong,
  spanFromMonthStart,
} from '../constancia-logic'

function day(
  date: string,
  status: CalendarDay['status'],
  calories: number | null = null,
): CalendarDay {
  return {
    date,
    dayNum: Number(date.slice(8)),
    weekdayIdx: 0,
    isToday: false,
    status,
    registered: {
      comida: false,
      agua: false,
      sueno: false,
      energia: false,
      peso: false,
      ciclo: false,
    },
    values: {
      mealCount: null,
      proteinG: null,
      calories,
      waterGlasses: null,
      sleepMinutes: null,
      energy: null,
      weightKg: null,
      onPeriod: false,
      workoutType: null,
    },
    events: [],
  }
}

describe('monthKeyBack / spanFromMonthStart', () => {
  test('retrocede meses cruzando el año', () => {
    expect(monthKeyBack('2026-10-04', 0)).toBe('2026-10')
    expect(monthKeyBack('2026-10-04', 10)).toBe('2025-12')
  })
  test('span = días desde el 1 del mes visto hasta hoy, inclusive', () => {
    expect(spanFromMonthStart('2026-10', '2026-10-04')).toBe(4)
    expect(spanFromMonthStart('2026-09', '2026-10-04')).toBe(34)
  })
})

describe('buildConstanciaMonth', () => {
  const target = 1577
  const days = new Map<string, CalendarDay>([
    ['2026-10-01', day('2026-10-01', 'trained', 1390)],
    ['2026-10-02', day('2026-10-02', 'trained', 1240)],
    ['2026-10-03', day('2026-10-03', 'rested', 1820)],
    // Bajo el piso sano (60%): nunca cuenta como déficit.
    ['2026-10-04', day('2026-10-04', 'empty', 500)],
  ])
  const m = buildConstanciaMonth('2026-10', '2026-10-04', days, target)

  test('el 1 de octubre 2026 (jueves) cae en la 4a columna L-D', () => {
    expect(m.cells.slice(0, 3)).toEqual([null, null, null])
    expect(m.cells[3]?.dayNum).toBe(1)
    expect(m.label).toBe('Octubre 2026')
  })
  test('cuenta entrenos, descansos y déficit del mes', () => {
    expect(m.trainedDays).toBe(2)
    expect(m.restedDays).toBe(1)
    expect(m.deficitDays).toBe(2)
  })
  test('los días por venir quedan marcados y sin estado', () => {
    const fifth = m.cells.find((c) => c?.dayNum === 5)
    expect(fifth?.isFuture).toBe(true)
    expect(fifth?.trained).toBe(false)
  })
})

describe('foodSummary', () => {
  test('déficit sano: lo que quedó bajo la meta', () => {
    expect(foodSummary(1240, 1577)).toEqual({
      kind: 'deficit',
      under: 337,
      calories: 1240,
      target: 1577,
    })
  })
  test('sobre la meta: solo el dato, marcado como over', () => {
    expect(foodSummary(1820, 1577)).toEqual({
      kind: 'plain',
      calories: 1820,
      target: 1577,
      over: true,
    })
  })
  test('bajo el piso sano: el dato sin llamarlo déficit', () => {
    expect(foodSummary(500, 1577)).toEqual({
      kind: 'plain',
      calories: 500,
      target: 1577,
      over: false,
    })
  })
  test('sin comida registrada', () => {
    expect(foodSummary(null, 1577)).toEqual({ kind: 'none' })
  })
})

test('sleepLong', () => {
  expect(sleepLong(418)).toBe('6 h 58 min')
  expect(sleepLong(45)).toBe('45 min')
  expect(sleepLong(480)).toBe('8 h')
})
