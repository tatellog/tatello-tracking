/*
 * El veredicto de una prueba, en humano (V-12 · R5). Copy REVISADA
 * (manifiesto + voz) — venía de MonthExperiments (la UI vieja); vive aquí
 * para que cualquier superficie la reuse sin duplicar. El resultado lo
 * decide el MOTOR (measureExperiment); esto solo lo dice sin culpa.
 */

/** Mínimo de días evaluables para arriesgar un veredicto (espejo del motor:
 *  measureExperiment usa la misma regla server-side). */
export function minMeasured(durationDays: number): number {
  return Math.min(durationDays, Math.max(4, Math.ceil(durationDays / 2)))
}

/** El resultado del motor → una frase cálida, sin culpa. Distingue "lo cerraste
 *  muy pronto" (pocos días medidos) de una señal genuinamente ambigua, para no
 *  hacer creer que faltan datos tuyos cuando en realidad falta seguir el hilo. */
export function resultLine(
  status: string | undefined,
  daysMeasured: number | undefined,
  durationDays: number | undefined,
): string {
  if (status === 'confirmed') return 'Se sostuvo en tus días.'
  if (status === 'discarded') return 'No se sostuvo esta vez, y eso también dice algo.'
  const d = daysMeasured ?? 0
  if (d < minMeasured(durationDays ?? 14)) {
    // "Lo cerraste el mismo día" leía a señalamiento frío (voice-and-copy
    // 23 jul): el caso corto se dice suave y unificado, sin "cerraste".
    const lead = d <= 1 ? 'Lo probaste solo un día' : `Lo seguiste ${d} días`
    return `${lead}. El hilo mira los días que lo sigues, no los de antes.`
  }
  return 'Aún no alcanza para saberlo.'
}

export function resultTone(status: string | undefined): 'good' | 'soft' {
  return status === 'confirmed' ? 'good' : 'soft'
}
