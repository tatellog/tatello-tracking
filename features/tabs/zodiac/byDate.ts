import type { ZodiacSign } from './types'

type Bound = {
  /** Month-day cutoff (inclusive on start day). */
  startMonth: number
  startDay: number
  sign: ZodiacSign
}

// Tropical zodiac. Each entry's `startMonth`/`startDay` is the day the
// sign begins; the previous entry runs up to the day before. Capricorn
// is the wrap-around case and gets resolved by the special branch below.
const BOUNDARIES: readonly Bound[] = [
  { startMonth: 1, startDay: 20, sign: 'acuario' },
  { startMonth: 2, startDay: 19, sign: 'piscis' },
  { startMonth: 3, startDay: 21, sign: 'aries' },
  { startMonth: 4, startDay: 20, sign: 'tauro' },
  { startMonth: 5, startDay: 21, sign: 'geminis' },
  { startMonth: 6, startDay: 21, sign: 'cancer' },
  { startMonth: 7, startDay: 23, sign: 'leo' },
  { startMonth: 8, startDay: 23, sign: 'virgo' },
  { startMonth: 9, startDay: 23, sign: 'libra' },
  { startMonth: 10, startDay: 23, sign: 'escorpio' },
  { startMonth: 11, startDay: 22, sign: 'sagitario' },
  { startMonth: 12, startDay: 22, sign: 'capricornio' },
]

const DEFAULT_SIGN: ZodiacSign = 'acuario'

/**
 * Maps a 'YYYY-MM-DD' birth date to a Spanish zodiac sign.
 * Returns `acuario` when the input is missing or malformed so the
 * UI always has something to render.
 */
export function zodiacFromDate(iso: string | null | undefined): ZodiacSign {
  if (!iso) return DEFAULT_SIGN
  const parts = iso.split('-').map(Number)
  const month = parts[1]
  const day = parts[2]
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return DEFAULT_SIGN
  }

  // Walk the boundary list and pick the latest sign whose cutoff has
  // passed. Capricorn wraps across Dec 22 → Jan 19, so anything before
  // Jan 20 (the acuario cutoff) defaults to capricornio.
  if (month === 1 && day < 20) return 'capricornio'
  let pick: ZodiacSign = DEFAULT_SIGN
  for (const b of BOUNDARIES) {
    if (month > b.startMonth || (month === b.startMonth && day >= b.startDay)) {
      pick = b.sign
    }
  }
  return pick
}
