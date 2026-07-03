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
  // El label llega en MAYÚSCULAS ("LEO"); en una frase gritaría. Title-case
  // para que lea "Leo empezó a despertar.", no "LEO empezó a despertar.".
  const sign = signLabel.charAt(0).toUpperCase() + signLabel.slice(1).toLowerCase()
  switch (threshold) {
    case 25:
      return {
        message: `Tu ${sign} empieza a despertar. Sus primeros trazos son tuyos.`,
        title: `${sign} empezó a despertar.`,
      }
    case 50:
      return {
        // No "la mitad de TI" — el reveal es del emblema, no del cuerpo
        // (manifiesto: nada de transformación corporal visual).
        message: `Tu ${sign} toma forma. Ya hay algo aquí que antes no estaba.`,
        title: `${sign} tomó forma.`,
      }
    case 75:
      return {
        message: `Tu ${sign} casi resplandece. Lo que sostienes, se nota.`,
        title: `${sign} casi resplandece.`,
      }
    case 100:
      return {
        // No "está completo" (eco de tarea-checkeada); el centro es "lo
        // que construiste sigue aquí".
        message: `Tu ${sign} despertó. Todo lo que construiste está aquí.`,
        title: `${sign} despertó.`,
      }
  }
}

/** Copy de la Revelación de Regreso (T2). Nunca menciona abandono / fracaso /
 *  pérdida — solo la bienvenida. (Borrador; pasa por voice-and-copy.) */
export const RETURN_COPY = {
  // Nunca abandono/fracaso/pérdida; "qué bueno verte" leía corporativo →
  // "Volviste" es más íntimo y es el término canónico del manifiesto.
  message: 'Volviste. Tu cielo te esperó.',
  title: 'Volviste a tu cielo.',
} as const

/**
 * Copy SIN CONTEO de las Revelaciones de Patrones (T3). `patterns/CLAUDE.md`
 * prohíbe cuantificadores de cadencia ("X de los últimos N días", "la mayoría
 * de tus noches"): la cadencia se SIENTE por el eyebrow ("ALGO CONSTANTE"), no
 * se CUENTA (contar = factura = vigilancia). El sujeto es el DATO, no la usuaria.
 * El número, si hace falta, vive como EVIDENCIA en el detalle, no en el narrativo.
 * (Borrador; pasa por voice-and-copy + manifesto-reviewer.)
 */
export function patternRevelationCopy(
  kind: string,
  _count: number,
  _windowDays: number,
): { message: string; title: string } {
  switch (kind) {
    // Lenguaje LLANO en todos (feedback usuaria: "muy fumado, me cuesta leer").
    // Título = hallazgo directo; mensaje = el mismo en simple. La evidencia (el
    // conteo) la pone patternEvidenceLine; la ceremonia NO agrega cierre poético.
    case 'protein_consistent':
      return {
        message: 'Cumpliste tu proteína con constancia.',
        title: 'Proteína constante.',
      }
    case 'training_consistent':
      return {
        message: 'Entrenaste con constancia.',
        title: 'Entreno constante.',
      }
    case 'sleep_consistent':
      return {
        message: 'Dormiste bien con constancia.',
        title: 'Descanso constante.',
      }
    case 'night_eating':
    default:
      return {
        // Lenguaje LLANO, no poético (feedback usuaria: "muy fumado"). El título
        // es el hallazgo directo; el mensaje es el mismo en simple.
        message: 'Comiste más tarde algunas noches.',
        title: 'Comida más tarde de lo normal.',
      }
  }
}

/**
 * La EVIDENCIA (prueba) de un patrón de constancia: la frecuencia como DATO
 * CONSULTADO en la ceremonia, no como titular. `patterns/CLAUDE.md` prohíbe el
 * conteo en el NARRATIVO (el titular/observación); como evidencia que respalda
 * la observación sí es defendible (revelations-spec Decisión #1). Vive SOLO en
 * el detalle/ceremonia. `''` sin conteo válido (no fabricamos "0 de N").
 * (Borrador; pasa por voice-and-copy + manifesto-reviewer.)
 */
export function patternEvidenceLine(kind: string, count: number, windowDays: number): string {
  if (!count || count <= 0 || !windowDays || windowDays <= 0) return ''
  switch (kind) {
    case 'protein_consistent':
      return `Tu proteína estuvo en objetivo ${count} de los últimos ${windowDays} días.`
    case 'training_consistent':
      return `Entrenaste ${count} de tus últimos ${windowDays} días.`
    case 'sleep_consistent':
      return `Tu descanso fue sólido en ${count} de tus últimas ${windowDays} noches.`
    case 'night_eating':
      return `${count} de tus últimas ${windowDays} noches tuvieron comida tardía.`
    default:
      return ''
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
