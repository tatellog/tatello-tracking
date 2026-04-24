const MINUS = '−'

export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${MINUS}${Math.abs(n)}`
  return `${n}`
}

export function formatDelta(value: number, unit: string): string {
  return `${formatSigned(value)} ${unit}`
}

export function formatProgressDeltas(input: {
  weightDeltaKg: number
  waistDeltaCm: number
  periodWeeks: number
}): string {
  const weight = formatDelta(input.weightDeltaKg, 'kg')
  const waist = `cintura ${formatDelta(input.waistDeltaCm, 'cm')}`
  const period = `${input.periodWeeks} semanas`
  return `${weight} · ${waist} · ${period}`
}

const monthNamesEs = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/*
 * Editorial date — '23 de abril' from an ISO 'YYYY-MM-DD' input.
 * Returns the raw string on malformed input rather than throwing; this runs
 * in a presentational layer and should never crash a render.
 */
export function formatEditorialDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const [, monthStr, dayStr] = parts
  if (!monthStr || !dayStr) return isoDate
  const monthIdx = Number.parseInt(monthStr, 10) - 1
  const day = Number.parseInt(dayStr, 10)
  const monthName = monthNamesEs[monthIdx]
  if (!monthName || Number.isNaN(day)) return isoDate
  return `${day} de ${monthName}`
}

const cardinalsEs: Record<number, string> = {
  0: 'cero',
  1: 'uno',
  2: 'dos',
  3: 'tres',
  4: 'cuatro',
  5: 'cinco',
  6: 'seis',
  7: 'siete',
  8: 'ocho',
  9: 'nueve',
  10: 'diez',
  11: 'once',
  12: 'doce',
  13: 'trece',
  14: 'catorce',
  15: 'quince',
}

/*
 * Spanish cardinal spelling for small numbers, used in the streak display.
 * We cap at 15 because beyond that, spelled forms start overflowing the
 * 72px serif display on narrow phones ('dieciséis', 'veintitrés', ...).
 * Callers should fall back to the numeral for larger values.
 */
export function spellCardinalEs(n: number): string | null {
  return cardinalsEs[n] ?? null
}

/*
 * Chooses between spelled-out and numeric display for the streak count, and
 * returns the trailing subtitle with correct singular/plural agreement.
 */
export function formatStreakCount(days: number): { headline: string; tail: string } {
  if (days === 1) return { headline: 'primer', tail: 'día escuchándote' }
  const spelled = spellCardinalEs(days)
  return { headline: spelled ?? String(days), tail: 'días escuchándote' }
}

const daysOfWeekEs = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

export function dayOfWeekEs(date: Date): string {
  const index = date.getDay()
  return daysOfWeekEs[index] ?? ''
}

/* ISO YYYY-MM-DD — the format `formatEditorialDate` consumes. */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

/* 24-hour H:MM clock — no leading zero on the hour, padded minutes. */
export function formatBriefTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
