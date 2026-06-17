/*
 * "Lo que alimenta tu transformación" — consistency over the last N
 * days (the rows in Comidas: Proteína / Agua — both real nutrients).
 *
 * PURE + manifesto-safe BY CONSTRUCTION. Tres reglas, aprendidas de datos
 * reales (2026-06-16) donde el card leía "1 de 10" sin que significara nada:
 *
 *   1. El denominador son los DÍAS QUE REGISTRASTE, no 10 de calendario:
 *      un día sin comidas no es una falla de proteína, es un día sin datos.
 *      Antes "1 de 10" castigaba el no-registrar; ahora "1 de los 2 días
 *      que registraste" es honesto.
 *   2. El umbral está SUAVIZADO (90% de la referencia): estar apenas debajo
 *      todos los días no es fallar — con target 120 y ~108 g un día cuenta.
 *   3. Cada día tiene 3 estados (alcanzó / registró-pero-corto / sin
 *      registrar) para que la tira distinga "no llegué" de "no registré".
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

export type ConsistencyScore = {
  /** Días registrados que alcanzaron el umbral. */
  reached: number
  /** Días con datos en la ventana — el DENOMINADOR (no el tamaño de ventana). */
  logged: number
  /** Tamaño de la ventana (largo de la tira de puntos). */
  total: number
  /** Estado por día, MÁS VIEJO→MÁS NUEVO (hoy al final). */
  days: DayState[]
}

export type NourishmentConsistency = {
  /** `null` when no protein reference is set — the row is then hidden,
   *  not shown as a score, which would read as failure. */
  protein: ConsistencyScore | null
  agua: ConsistencyScore
}

/** Un día cuenta como "fuerte" si llega al 90% de la referencia: estar al
 *  borde no es fallar. Aplica a proteína (referencia) y agua (meta de vasos). */
export const REACH_RATIO = 0.9

function tally(days: DayState[]): { reached: number; logged: number } {
  let reached = 0
  let logged = 0
  for (const s of days) {
    if (s !== 'empty') logged++
    if (s === 'reached') reached++
  }
  return { reached, logged }
}

export function computeNourishmentConsistency(args: {
  /** The window of calendar days (oldest→newest), e.g. the last 10. */
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
  const aguaBar = goal * REACH_RATIO

  // Agua: 'empty' si no registraste vasos ese día; si registraste, 'reached'
  // al llegar al 90% de la meta, si no 'short'.
  const aguaDays: DayState[] = dates.map((d) => {
    const g = waterByDate[d] ?? 0
    if (g <= 0) return 'empty'
    return g >= aguaBar ? 'reached' : 'short'
  })

  const proteinDays: DayState[] | null =
    proteinTarget == null || proteinTarget <= 0
      ? null
      : dates.map((d) => {
          if (!proteinByDate.has(d)) return 'empty' // sin comidas ese día
          return (proteinByDate.get(d) ?? 0) >= proteinTarget * REACH_RATIO ? 'reached' : 'short'
        })

  return {
    protein: proteinDays == null ? null : { ...tally(proteinDays), total, days: proteinDays },
    agua: { ...tally(aguaDays), total, days: aguaDays },
  }
}
