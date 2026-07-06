/*
 * "Lo que alimenta tu transformación" — consistency over the last N
 * days (the rows in Comidas: Proteína / Agua — both real nutrients).
 *
 * PURE + manifesto-safe BY CONSTRUCTION. Reglas, aprendidas de datos
 * reales (2026-06-16) y del feedback beta (2026-07-05, "leo bug, no matiz"):
 *
 *   1. El denominador son los DÍAS QUE REGISTRASTE, no la ventana entera:
 *      un día sin comidas no es una falla de proteína, es un día sin datos.
 *   2. El umbral está SUAVIZADO (90% de la referencia): estar apenas debajo
 *      todos los días no es fallar — con target 120 y ~108 g un día cuenta.
 *   3. Cada día lleva su `ratio` real (0..1): el "registré pero no llegué"
 *      se dibuja como ALTURA de relleno (geometría, patrón Apple), nunca
 *      como opacidad — el tenue se leía como decoración o como bug.
 *   4. HOY (la última marca) está ABIERTO: no cuenta en reached/logged —
 *      a las 9 am "no llegaste" sería mentira. Su barra vive en directo.
 *
 * Nunca "good/bad food", nunca un streak rígido, nunca un %-to-shame.
 *
 * Calorías a propósito NO son una fila: puntuar "días bajo un target de
 * calorías" premiaría la restricción (la línea roja clínica) y volvería las
 * calorías el countdown que el manifiesto prohíbe.
 */

/** Estado de un día en la ventana para una fila. */
export type DayState =
  | 'reached' // registrado y llegó al umbral (90% de la referencia / meta)
  | 'short' // registrado pero por debajo — registraste, aún no llegaste
  | 'empty' // sin registro ese día — no es falla, es ausencia de datos

/** Una marca por día: fecha + estado + progreso real vs la referencia
 *  (0..1, capado a 1). La barra rellena `ratio`; el color nunca cambia
 *  de significado. */
export type DayMark = {
  date: string
  state: DayState
  ratio: number
}

export type ConsistencyScore = {
  /** Días CERRADOS que alcanzaron el umbral (hoy, abierto, no se juzga). */
  reached: number
  /** Días CERRADOS con datos — el DENOMINADOR (no el tamaño de ventana). */
  logged: number
  /** Tamaño de la ventana (largo de la tira). */
  total: number
  /** Marca por día, MÁS VIEJO→MÁS NUEVO (hoy al final, en vivo). */
  days: DayMark[]
}

export type NourishmentConsistency = {
  /** `null` when no protein reference is set — the row is then hidden,
   *  not shown as a score, which would read as failure. */
  protein: ConsistencyScore | null
  agua: ConsistencyScore
  /** Referencias visibles en la card ("llegaste ¿a qué?" necesita el
   *  número; la excepción de Comidas lo autoriza). */
  proteinTarget: number | null
  waterGoalGlasses: number
}

/** Un día cuenta como "fuerte" si llega al 90% de la referencia: estar al
 *  borde no es fallar. Aplica a proteína (referencia) y agua (meta de vasos). */
export const REACH_RATIO = 0.9

/** Cuenta SOLO los días cerrados: la última marca es hoy y sigue abierta. */
function tally(days: DayMark[]): { reached: number; logged: number } {
  let reached = 0
  let logged = 0
  for (const m of days.slice(0, -1)) {
    if (m.state !== 'empty') logged++
    if (m.state === 'reached') reached++
  }
  return { reached, logged }
}

function mark(date: string, value: number | null, target: number): DayMark {
  if (value == null || value <= 0) return { date, state: 'empty', ratio: 0 }
  const ratio = Math.min(1, value / target)
  return { date, state: value >= target * REACH_RATIO ? 'reached' : 'short', ratio }
}

export function computeNourishmentConsistency(args: {
  /** The window of calendar days (oldest→newest, HOY al final). */
  dates: readonly string[]
  meals: readonly { meal_date: string | null; protein_g: number | string }[]
  /** glasses logged per `intake_date` within the window. */
  waterByDate: Readonly<Record<string, number>>
  /** The user's protein reference, or null if unset. */
  proteinTarget: number | null
  /** Glasses that count as "goal met" for a day (>= 1). */
  waterGoalGlasses: number
}): NourishmentConsistency {
  const { dates, meals, waterByDate, proteinTarget, waterGoalGlasses } = args
  const inWindow = new Set(dates)
  // Proteína por día — solo de los días con comidas (la PRESENCIA de la clave
  // marca "registraste ese día", aunque la suma sea baja).
  const proteinByDate = new Map<string, number>()
  for (const m of meals) {
    if (m.meal_date == null || !inWindow.has(m.meal_date)) continue
    proteinByDate.set(m.meal_date, (proteinByDate.get(m.meal_date) ?? 0) + Number(m.protein_g))
  }

  const total = dates.length
  const goal = Math.max(1, waterGoalGlasses)

  const aguaDays: DayMark[] = dates.map((d) => mark(d, waterByDate[d] ?? null, goal))

  const proteinDays: DayMark[] | null =
    proteinTarget == null || proteinTarget <= 0
      ? null
      : dates.map((d) => mark(d, proteinByDate.get(d) ?? null, proteinTarget))

  return {
    protein: proteinDays == null ? null : { ...tally(proteinDays), total, days: proteinDays },
    agua: { ...tally(aguaDays), total, days: aguaDays },
    proteinTarget,
    waterGoalGlasses: goal,
  }
}
