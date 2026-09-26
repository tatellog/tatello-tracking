/*
 * El turno del check-in de Hoy — PURO y testeable.
 *
 * Hoy tiene dos filas fijas sobre el cielo: entreno (arriba) y sueño (abajo).
 * Están siempre presentes, pero UNA sola pregunta está viva a la vez
 * (decisión dueña sep 2026: "una pregunta a la vez" = una viva por momento;
 * lo demás es puerta quieta, nunca formulario). La hora decide cuál abre:
 * antes del mediodía lo único que ya pasó es la noche, así que pregunta el
 * sueño; desde el mediodía pregunta el entreno, y al responderlo abre el
 * sueño una vez si sigue pendiente. Cerrar una ("Después") la deja quieta;
 * "anotar" / "cambiar" la abren a mano y cierran la otra.
 */

export type CheckInMode = 'ask' | 'answered' | 'quiet'

/** Hasta esta hora (exclusiva) la mañana pregunta el sueño, no el entreno. */
export const CHECKIN_MORNING_UNTIL_HOUR = 12

export type CheckInTurn = { workout: CheckInMode; sleep: CheckInMode }

export function checkInTurn(input: {
  /** Hora local 0-23. */
  hour: number
  /** Entreno o descanso ya respondido (a mano o sellado por el reloj). */
  workoutAnswered: boolean
  /** Noche ya anotada (a mano o del reloj). */
  sleepAnswered: boolean
  /** La usuaria abrió (true) o cerró (false) cada bloque a mano; null = automático. */
  workoutOpen: boolean | null
  sleepOpen: boolean | null
  /** Modo "ver día": el entreno se puede rellenar; el sueño nunca pregunta solo. */
  past?: boolean
}): CheckInTurn {
  const { hour, workoutAnswered, sleepAnswered, workoutOpen, sleepOpen, past = false } = input

  // Apertura manual: manda, y solo una a la vez (el padre cierra la otra).
  if (sleepOpen === true) {
    return { workout: workoutAnswered ? 'answered' : 'quiet', sleep: 'ask' }
  }
  if (workoutOpen === true) {
    return { workout: 'ask', sleep: sleepAnswered ? 'answered' : 'quiet' }
  }

  const workoutRest: CheckInMode = workoutAnswered ? 'answered' : 'quiet'
  const sleepRest: CheckInMode = sleepAnswered ? 'answered' : 'quiet'
  const workoutCanAsk = !workoutAnswered && workoutOpen !== false
  const sleepCanAsk = !sleepAnswered && sleepOpen !== false

  // Un día pasado: el entreno se ofrece (backfill), la noche solo por puerta.
  if (past) {
    return { workout: workoutCanAsk ? 'ask' : workoutRest, sleep: sleepRest }
  }

  const morning = hour < CHECKIN_MORNING_UNTIL_HOUR
  if (morning) {
    // Por la mañana el entreno aún no pasó: no se pregunta solo.
    return { workout: workoutRest, sleep: sleepCanAsk ? 'ask' : sleepRest }
  }
  if (workoutCanAsk) return { workout: 'ask', sleep: sleepRest }
  return { workout: workoutRest, sleep: sleepCanAsk ? 'ask' : sleepRest }
}
