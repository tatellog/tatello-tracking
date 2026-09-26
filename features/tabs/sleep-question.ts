import { formatSleepShort } from '@/features/wearables/recovery'

/*
 * La pregunta de sueño de Hoy — datos PUROS y testeables (chips y copy).
 * Cuándo pregunta lo decide checkin-turn.ts.
 */

/*
 * Los chips de horas. Media hora de precisión: por debajo de la banda de ruido
 * del motor (±45 min) y por encima de sus umbrales (6 h / 7 h). Los extremos
 * son abiertos: la noche corta es la señal más útil para patrones y no cabe
 * en una cifra exacta. Los minutos guardados son el centro de cada chip.
 */
export type SleepChip = { label: string; minutes: number; a11y: string }

export const SLEEP_CHIPS: readonly SleepChip[] = [
  { label: '‹6', minutes: 330, a11y: 'Menos de 6 horas' },
  { label: '6', minutes: 360, a11y: '6 horas' },
  { label: '6½', minutes: 390, a11y: '6 horas y media' },
  { label: '7', minutes: 420, a11y: '7 horas' },
  { label: '7½', minutes: 450, a11y: '7 horas y media' },
  { label: '8', minutes: 480, a11y: '8 horas' },
  { label: '8½+', minutes: 510, a11y: '8 horas y media o más' },
]

export const SLEEP_CHIP_SHORT = SLEEP_CHIPS[0]!.minutes
export const SLEEP_CHIP_LONG = SLEEP_CHIPS[SLEEP_CHIPS.length - 1]!.minutes

/** El chip más cercano a una duración (para resaltar la noche ya anotada o
 *  la que trajo el reloj). Null sin duración. */
export function nearestSleepChip(minutes: number | null | undefined): SleepChip | null {
  if (minutes == null) return null
  let best = SLEEP_CHIPS[0]!
  for (const c of SLEEP_CHIPS) {
    if (Math.abs(c.minutes - minutes) < Math.abs(best.minutes - minutes)) best = c
  }
  return best
}

/**
 * La línea colapsada. Un valor anotado a mano en un chip abierto se lee como
 * lo que la usuaria eligió ("menos de 6 h", "8 h 30 o más"); todo lo demás
 * (chips cerrados, reloj, registros viejos de 15 min) se imprime exacto.
 */
export function sleepAnsweredText(
  minutes: number,
  opts: { manual: boolean; past?: boolean },
): string {
  const lead = opts.past ? 'Esa noche dormiste ' : 'Dormiste '
  if (opts.manual && minutes === SLEEP_CHIP_SHORT) return `${lead}menos de 6 h`
  if (opts.manual && minutes === SLEEP_CHIP_LONG) return `${lead}8 h 30 o más`
  return `${lead}${formatSleepShort(minutes)}`
}
