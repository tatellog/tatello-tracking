import { buildMonthGrid, buildTrailingDays, effectiveTrainingPhrase } from '../month-grid'

describe('buildMonthGrid', () => {
  test('a 31-day month → grid of 31, target = days in month', () => {
    const m = buildMonthGrid('2026-03-15', ['2026-03-01', '2026-03-10', '2026-03-15'])
    expect(m.daysInMonth).toBe(31)
    expect(m.grid).toHaveLength(31)
    expect(m.todayIdx).toBe(14)
    expect(m.trainedThisMonth).toBe(3)
    expect(m.grid[0]).toBe(true) // day 1, trained
    expect(m.grid[9]).toBe(true) // day 10, trained
    expect(m.grid[14]).toBe(true) // day 15 = today, trained
  })

  test('a workout dated in the future is NOT lit', () => {
    const m = buildMonthGrid('2026-03-15', ['2026-03-20'])
    expect(m.grid[19]).toBe(false) // day 20 is after today
    expect(m.trainedThisMonth).toBe(0)
  })

  test('February adapts — 28 days in a common year, 29 in a leap year', () => {
    expect(buildMonthGrid('2026-02-10', []).daysInMonth).toBe(28)
    expect(buildMonthGrid('2024-02-10', []).daysInMonth).toBe(29)
  })

  test('cells carry the real dates + flag today', () => {
    const m = buildMonthGrid('2026-03-15', [])
    expect(m.cells[0]!.date).toBe('2026-03-01')
    expect(m.cells[30]!.date).toBe('2026-03-31')
    expect(m.cells[14]!.isToday).toBe(true)
    expect(m.cells.filter((c) => c.isToday)).toHaveLength(1)
  })

  test('flags future days (date > today) — never owed in advance', () => {
    const m = buildMonthGrid('2026-03-15', [])
    expect(m.cells[14]!.isFuture).toBe(false) // today
    expect(m.cells[13]!.isFuture).toBe(false) // yesterday
    expect(m.cells[15]!.isFuture).toBe(true) // tomorrow
    expect(m.cells[30]!.isFuture).toBe(true) // month's end
    // A fully past month (browsed from June) has no future days.
    const past = buildMonthGrid('2026-03-01', [], '2026-06-02')
    expect(past.cells.every((c) => !c.isFuture)).toBe(true)
  })

  test('no workouts → empty figure (nothing lit)', () => {
    const m = buildMonthGrid('2026-04-12', [])
    expect(m.daysInMonth).toBe(30)
    expect(m.trainedThisMonth).toBe(0)
    expect(m.grid.every((g) => g === false)).toBe(true)
  })

  test('browsing a PAST month (separate `today`) lights every trained day', () => {
    // Standing in June, look back at March — all of March is in the past,
    // so future-gating must not blank it out.
    const m = buildMonthGrid('2026-03-01', ['2026-03-05', '2026-03-28'], '2026-06-02')
    expect(m.trainedThisMonth).toBe(2)
    expect(m.grid[4]).toBe(true) // March 5
    expect(m.grid[27]).toBe(true) // March 28
    expect(m.todayIdx).toBe(-1) // today isn't in this month
  })

  test('a FUTURE month relative to today lights nothing', () => {
    const m = buildMonthGrid('2026-07-01', ['2026-07-10'], '2026-06-02')
    expect(m.trainedThisMonth).toBe(0)
    expect(m.todayIdx).toBe(-1)
  })
})

describe('buildTrailingDays', () => {
  test('ends on today (last cell), spans the month boundary backwards', () => {
    const days = buildTrailingDays('2026-06-02', ['2026-05-30', '2026-06-02'], 30)
    expect(days).toHaveLength(30)
    const last = days[days.length - 1]!
    expect(last.date).toBe('2026-06-02')
    expect(last.isToday).toBe(true)
    expect(days[0]!.date).toBe('2026-05-04') // 29 days before today
    // Only the today cell is flagged.
    expect(days.filter((d) => d.isToday)).toHaveLength(1)
    // Trained days light up regardless of which month they fall in.
    expect(days.find((d) => d.date === '2026-05-30')!.trained).toBe(true)
    expect(last.trained).toBe(true)
  })

  test('never includes a future day', () => {
    const days = buildTrailingDays('2026-06-02', ['2026-06-05'], 10)
    expect(days.every((d) => d.date <= '2026-06-02')).toBe(true)
    expect(days.some((d) => d.trained)).toBe(false)
  })
})

describe('effectiveTrainingPhrase', () => {
  test('under a month → just the day count', () => {
    expect(effectiveTrainingPhrase(0)).toBe('0 días')
    expect(effectiveTrainingPhrase(1)).toBe('1 día')
    expect(effectiveTrainingPhrase(12)).toBe('12 días')
    expect(effectiveTrainingPhrase(29)).toBe('29 días')
  })

  test('a full month → months + remainder days, pluralised', () => {
    expect(effectiveTrainingPhrase(30)).toBe('1 mes')
    expect(effectiveTrainingPhrase(31)).toBe('1 mes y 1 día')
    expect(effectiveTrainingPhrase(35)).toBe('1 mes y 5 días')
    expect(effectiveTrainingPhrase(60)).toBe('2 meses')
    expect(effectiveTrainingPhrase(65)).toBe('2 meses y 5 días')
  })
})
