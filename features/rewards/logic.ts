/*
 * Capa 1 del sistema de recompensas — REGRESO.
 *
 * Volver después de días fuera es EL momento más frágil de la relación
 * con la app: la mayoría espera un reproche ("perdiste tu racha") y eso
 * es exactamente lo que las hace no volver. Aquí la ausencia se recibe,
 * nunca se castiga: sin contar los días fuera, sin reiniciar nada, sin
 * "te extrañamos" pasivo-agresivo. Solo una frase cálida de regreso.
 *
 * PURO y determinístico — la UI (ReturnMoment) anima lo que esto decide.
 * La persistencia del "último día visto" vive en useReturnMoment.
 */

/** Días fuera a partir de los cuales el regreso se celebra. Con 1–2 la
 *  frase aparecería tras cualquier fin de semana y perdería significado;
 *  3+ es una ausencia real que merece recibimiento. */
export const RETURN_GAP_MIN_DAYS = 3

// Las cuatro frases del spec, sin el glifo "✦" (lo pone la UI).
// Observan y reciben — ninguna menciona cuánto faltaste.
export const RETURN_PHRASES = [
  'Qué bueno verte otra vez.',
  'Tu cielo te estaba esperando.',
  'El universo sigue aquí.',
  'Retomemos donde nos quedamos.',
] as const

/** Días entre dos fechas ISO locales (b − a). Parse por componentes +
 *  Date.UTC: sin drift de medianoche-UTC ni sorpresas de DST. */
export function daysBetweenIso(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number]
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number]
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** ¿Este open merece el momento de regreso? Nunca en el primer uso
 *  (no hay "regreso" sin un antes) ni con fechas malformadas. */
export function shouldCelebrateReturn(lastSeenIso: string | null, todayIso: string): boolean {
  if (!lastSeenIso) return false
  const gap = daysBetweenIso(lastSeenIso, todayIso)
  if (!Number.isFinite(gap)) return false
  return gap >= RETURN_GAP_MIN_DAYS
}

/** Frase del día — determinística (rota con la fecha, no Math.random):
 *  testeable, y dos opens el mismo día dicen lo mismo. */
export function pickReturnPhrase(todayIso: string): string {
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number]
  const idx = Math.abs(y + m + d) % RETURN_PHRASES.length
  return RETURN_PHRASES[idx] ?? RETURN_PHRASES[0]
}
