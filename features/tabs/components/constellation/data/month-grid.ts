/*
 * Month-aligned training grid for the constellation. Replaces the rolling
 * 28-day window with the CURRENT calendar month: one cell per day of the
 * month (28/29/30/31), lit if a workout exists that day (only up to
 * today). The constellation's target becomes `daysInMonth`, so the figure
 * fills across the real month instead of a fixed 28-day cycle. Pure.
 */

export type MonthCell = {
  date: string
  trained: boolean
  isToday: boolean
  /** The day hasn't happened yet (date > today). A future day is blank
   *  canvas, NOT a missed day — it must read with almost no visual
   *  weight so the month never feels like pre-owed debt (manifiesto). */
  isFuture: boolean
}

export type MonthGrid = {
  /** One cell per day of the month — carries the date for the strip. */
  cells: MonthCell[]
  /** Just the trained flags — what the constellation consumes. */
  grid: boolean[]
  daysInMonth: number
  todayIdx: number
  trainedThisMonth: number
}

/** Build the grid for the month that `monthRef` ('YYYY-MM-DD') lands in.
 *  A day is lit if it was trained AND is not in the future (`<= today`).
 *  `today` defaults to `monthRef`, so the current-month call site is
 *  unchanged; the Progreso calendar passes a past month's ref + the real
 *  today to browse history. */
export function buildMonthGrid(
  monthRef: string,
  workoutDates: readonly string[],
  today: string = monthRef,
): MonthGrid {
  const [y, m] = monthRef.split('-').map(Number) as [number, number]
  // `m` is 1-based; `new Date(y, m, 0)` rolls back to the last day of month m.
  const daysInMonth = new Date(y, m, 0).getDate()
  const trained = new Set(workoutDates)
  const pad = (n: number): string => String(n).padStart(2, '0')

  const cells: MonthCell[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    const date = `${y}-${pad(m)}-${pad(i)}`
    cells.push({
      date,
      trained: date <= today && trained.has(date),
      isToday: date === today,
      isFuture: date > today,
    })
  }
  return {
    cells,
    grid: cells.map((c) => c.trained),
    daysInMonth,
    todayIdx: cells.findIndex((c) => c.isToday),
    trainedThisMonth: cells.filter((c) => c.trained).length,
  }
}

/** A trailing window of `span` days ending TODAY (today last/right —
 *  the "principal"), oldest first. Unlike the calendar grid this never
 *  shows future days; it's the editable history strip you scroll back
 *  through. Spans month boundaries, so the caller must pass workout
 *  dates covering the whole window. */
export function buildTrailingDays(
  today: string,
  workoutDates: readonly string[],
  span = 30,
): MonthCell[] {
  const trained = new Set(workoutDates)
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const pad = (n: number): string => String(n).padStart(2, '0')
  const out: MonthCell[] = []
  for (let i = span - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i))
    const date = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
    // A trailing window ends on today, so nothing in it is ever future.
    out.push({ date, trained: trained.has(date), isToday: i === 0, isFuture: false })
  }
  return out
}

/** "35 trained days" → a human phrase: "1 mes y 5 días", "2 meses",
 *  "12 días". A "month of effective training" is 30 trained days. */
export function effectiveTrainingPhrase(total: number): string {
  if (total < 30) return `${total} ${total === 1 ? 'día' : 'días'}`
  const months = Math.floor(total / 30)
  const days = total % 30
  const monthPart = `${months} ${months === 1 ? 'mes' : 'meses'}`
  if (days === 0) return monthPart
  return `${monthPart} y ${days} ${days === 1 ? 'día' : 'días'}`
}
