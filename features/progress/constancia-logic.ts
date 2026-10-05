/*
 * Tu constancia · lógica PURA del calendario y de la hoja del día (rediseño
 * dueña 4 oct 2026: "más como Apple Fitness / Salud, con información útil").
 *
 * El mes se lee de un vistazo: entrenaste (magenta), descansaste (índigo),
 * día en déficit (punto oro). Arriba, tres números DEL MES visto: días
 * entrenados, días en déficit y descansos. Sin rachas ni conteos de registros.
 *
 * El déficit usa el MISMO juicio que Mes y Descubre (`isDeficitDay`, con su
 * piso sano): un día bajo el 60% de la meta nunca se celebra como déficit.
 */
import { DEFICIT_FLOOR_RATIO, isDeficitDay } from '@/features/orbit/deficit'
import type { CalendarDay } from '@/features/tabs/components/calendar/logic'

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

export type ConstanciaCell = {
  date: string
  dayNum: number
  trained: boolean
  rested: boolean
  deficit: boolean
  isToday: boolean
  isFuture: boolean
}

export type ConstanciaMonth = {
  /** "Octubre 2026". */
  label: string
  /** Huecos iniciales (null) para que el día 1 caiga en su columna L-D. */
  cells: (ConstanciaCell | null)[]
  trainedDays: number
  deficitDays: number
  restedDays: number
}

/** 'YYYY-MM' del mes que está `monthsBack` meses antes del de `today`. */
export function monthKeyBack(today: string, monthsBack: number): string {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const idx = y * 12 + (m - 1) - monthsBack
  const yy = Math.floor(idx / 12)
  const mm = (idx % 12) + 1
  return `${yy}-${String(mm).padStart(2, '0')}`
}

/** Días desde el 1 del mes `monthKey` hasta `today`, inclusive (≥ 1). */
export function spanFromMonthStart(monthKey: string, today: string): number {
  const start = Date.UTC(...ymd(`${monthKey}-01`))
  const end = Date.UTC(...ymd(today))
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1)
}

export function buildConstanciaMonth(
  monthKey: string,
  today: string,
  daysByDate: ReadonlyMap<string, CalendarDay>,
  calorieTarget: number | null,
): ConstanciaMonth {
  const [y, m] = monthKey.split('-').map(Number) as [number, number]
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  // Lunes primero: getUTCDay 0=Dom → columna 6.
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7

  const cells: (ConstanciaCell | null)[] = Array.from({ length: lead }, () => null)
  let trainedDays = 0
  let deficitDays = 0
  let restedDays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${monthKey}-${String(d).padStart(2, '0')}`
    const day = daysByDate.get(date)
    const isFuture = date > today
    const trained = !isFuture && day?.status === 'trained'
    const rested = !isFuture && day?.status === 'rested'
    const deficit =
      !isFuture && calorieTarget != null && isDeficitDay(day?.values.calories, calorieTarget)
    if (trained) trainedDays++
    if (rested) restedDays++
    if (deficit) deficitDays++
    cells.push({ date, dayNum: d, trained, rested, deficit, isToday: date === today, isFuture })
  }
  return { label: `${MONTHS[m - 1]} ${y}`, cells, trainedDays, deficitDays, restedDays }
}

/** La tarjeta de comida de la hoja del día. */
export type FoodSummary =
  | { kind: 'none' }
  | { kind: 'deficit'; under: number; calories: number; target: number }
  /** Sobre la meta, o bajo el piso sano: se muestra lo comido, sin juicio. */
  | { kind: 'plain'; calories: number; target: number | null; over: boolean }

export function foodSummary(
  calories: number | null | undefined,
  calorieTarget: number | null | undefined,
): FoodSummary {
  if (calories == null || calories <= 0) return { kind: 'none' }
  const cal = Math.round(calories)
  if (calorieTarget == null || calorieTarget <= 0) {
    return { kind: 'plain', calories: cal, target: null, over: false }
  }
  const target = Math.round(calorieTarget)
  if (isDeficitDay(calories, calorieTarget)) {
    return { kind: 'deficit', under: target - cal, calories: cal, target }
  }
  // Bajo el piso sano no se comenta (comentar restricción extrema sería
  // celebrarla o señalarla): solo el dato.
  const over = calories > calorieTarget && calories >= calorieTarget * DEFICIT_FLOOR_RATIO
  return { kind: 'plain', calories: cal, target, over }
}

/** "6 h 58 min" / "45 min". */
export function sleepLong(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

function ymd(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return [y, m - 1, d]
}
