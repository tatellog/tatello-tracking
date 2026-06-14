import type { RevelationTier } from './api'

/*
 * El cerebro del orquestador — PURO y testeable. Decide UNA revelación a
 * mostrar al abrir Hoy (o ninguna). Spec: docs/revelations-system-spec.md.
 *
 * Prioridad: Regreso > Transformación > Patrón > Nada.
 *   · El PRD solo ordena Regreso > Patrón; la posición de Transformación
 *     (en medio) es decisión de implementación: a quien vuelve se le
 *     recibe primero; su hito ganado y la observación esperan su turno.
 *   · "Una por sesión": lo no mostrado PERSISTE para una sesión futura —
 *     los umbrales de transformación se registran solo al mostrarse, así
 *     que el siguiente abrir Hoy retoma donde quedó. Nada se pierde.
 */

export const TRANSFORMATION_THRESHOLDS = [25, 50, 75, 100] as const
export type TransformationThreshold = (typeof TRANSFORMATION_THRESHOLDS)[number]

/** Un regreso por episodio (~1 día): tras mostrarlo, no re-disparar hoy. */
export const RETURN_DEDUP_MS = 20 * 60 * 60 * 1000
/** Máximo 1 patrón cada 7 días (cualquier patrón). */
export const PATTERN_RATE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000

export type PendingRevelation = {
  tier: RevelationTier
  kind: string
  /** Copy de la ceremonia full-screen (voz del coach). */
  message: string
  /** Línea de Historia ("Leo despertó."). */
  title: string
  /** Evidencia (patrones): { count, window_days } para el copy con conteos. */
  metadata?: Record<string, unknown>
}

/**
 * Copy de las ceremonias de Transformación (T1) por umbral. Referencia el
 * signo para cuando otros signos tengan emblema. Voz del coach — observa el
 * despertar, nunca exige. (Borrador; pasa por voice-and-copy.)
 */
export function transformationCopy(
  threshold: TransformationThreshold,
  signLabel: string,
): { message: string; title: string } {
  switch (threshold) {
    case 25:
      return {
        message: `Tu ${signLabel} empieza a despertar. Sus primeros trazos son tuyos.`,
        title: `${signLabel} empezó a despertar.`,
      }
    case 50:
      return {
        // No "la mitad de TI" — el reveal es del emblema, no del cuerpo
        // (manifiesto: nada de transformación corporal visual).
        message: `Tu ${signLabel} toma forma. Ya hay algo aquí que antes no estaba.`,
        title: `${signLabel} tomó forma.`,
      }
    case 75:
      return {
        message: `Tu ${signLabel} casi resplandece. Lo que sostienes, se nota.`,
        title: `${signLabel} casi resplandece.`,
      }
    case 100:
      return {
        // No "está completo" (eco de tarea-checkeada); el centro es "lo
        // que construiste sigue aquí".
        message: `Tu ${signLabel} despertó. Todo lo que construiste está aquí.`,
        title: `${signLabel} despertó.`,
      }
  }
}

/** Copy de la Revelación de Regreso (T2). Nunca menciona abandono / fracaso /
 *  pérdida — solo la bienvenida. (Borrador; pasa por voice-and-copy.) */
export const RETURN_COPY = {
  // Nunca abandono/fracaso/pérdida; "qué bueno verte" leía corporativo →
  // "Volviste" es más íntimo y es el término canónico del manifiesto.
  message: 'Volviste. Todo lo que construiste te esperó aquí.',
  title: 'Volviste a tu cielo.',
} as const

/**
 * Copy CON CONTEO de las Revelaciones de Patrones (T3). Enmarcado por tono
 * (behavioral + spec Decisión #8): en positivos el conteo va al frente y
 * "hacia arriba" (X/N = constancia, nunca "te faltaron 2"); en el noticing
 * la observación cálida va primero y el número al PIE como contexto, con el
 * sujeto en "las noches". (Borrador; pasa por voice-and-copy.)
 */
export function patternRevelationCopy(
  kind: string,
  count: number,
  windowDays: number,
): { message: string; title: string } {
  switch (kind) {
    case 'protein_consistent':
      return {
        message: `${count} de los últimos ${windowDays} días tu proteína estuvo presente. Ya tiene forma.`,
        title: 'Proteína constante.',
      }
    case 'training_consistent':
      return {
        // Sujeto = el dato (el movimiento), no la usuaria ("te moviste"),
        // parejo con las otras cadenas (regla de sujeto de patterns).
        message: `${count} de los últimos ${windowDays} días el movimiento estuvo ahí. Ya es un ritmo.`,
        title: 'Un ritmo de movimiento.',
      }
    case 'sleep_consistent':
      return {
        message: `${count} de los últimos ${windowDays} días tu descanso fue sólido. Tu cuerpo tuvo eso.`,
        title: 'Descanso más estable.',
      }
    case 'night_eating':
    default:
      return {
        message: `Las noches pidieron más esta semana. Registraste algo tarde en ${count} de los últimos ${windowDays} días.`,
        title: 'Un patrón en tus noches.',
      }
  }
}

export type OrchestratorPattern = {
  kind: string
  message: string
  title: string
  metadata?: Record<string, unknown>
}

export type OrchestratorInput = {
  nowMs: number
  // T1 · Transformación
  transformProgress: number
  shownTransformationKinds: readonly string[]
  signLabel: string
  // T2 · Regreso
  returnSignal: boolean
  lastReturnAtMs: number | null
  // T3 · Patrón ya detectado (o null), + cuándo se mostró el último patrón
  pattern: OrchestratorPattern | null
  lastPatternAtMs: number | null
}

/** Decide la revelación a mostrar (o null) según la prioridad y los rate-limits. */
export function selectRevelation(input: OrchestratorInput): PendingRevelation | null {
  // T2 · Regreso — máx 1 por episodio.
  if (
    input.returnSignal &&
    (input.lastReturnAtMs == null || input.nowMs - input.lastReturnAtMs > RETURN_DEDUP_MS)
  ) {
    return {
      tier: 'return',
      kind: 'return',
      message: RETURN_COPY.message,
      title: RETURN_COPY.title,
    }
  }

  // T1 · Transformación — el umbral MÁS BAJO cruzado y aún no mostrado (los
  // hitos se celebran en orden; si se cruzan dos a la vez, el otro espera).
  for (const t of TRANSFORMATION_THRESHOLDS) {
    if (input.transformProgress >= t && !input.shownTransformationKinds.includes(String(t))) {
      const copy = transformationCopy(t, input.signLabel)
      return { tier: 'transformation', kind: String(t), message: copy.message, title: copy.title }
    }
  }

  // T3 · Patrón — máx 1 / 7 días.
  if (
    input.pattern &&
    (input.lastPatternAtMs == null || input.nowMs - input.lastPatternAtMs >= PATTERN_RATE_LIMIT_MS)
  ) {
    return {
      tier: 'pattern',
      kind: input.pattern.kind,
      message: input.pattern.message,
      title: input.pattern.title,
      metadata: input.pattern.metadata,
    }
  }

  return null
}
