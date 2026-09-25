import type { Finding, FindingCategory, MonthlyReport } from './engine.ts'

/*
 * El arco de evidencia de un hallazgo (V-10 · Personal Evidence) — el
 * proceso visible: observamos → encontramos → lo estamos siguiendo →
 * confirmado. 100% determinístico (jamás se disfraza de IA, sin ✦): el
 * estado se DERIVA del pipeline persistido, nunca se declara a mano.
 *
 *   · observamos    — implícito: si hay hallazgo, hubo datos observados.
 *                     (El estado "aún observando" es el vacío honesto de la
 *                     superficie cuando no hay findings.)
 *   · encontrado    — el finding existe en el reporte de este periodo.
 *   · investigando  — una hipótesis viva (open/experimenting) lo referencia,
 *                     directo o vía su historia: el motor lo está siguiendo.
 *   · confirmado    — una hipótesis suya llegó a 'confirmed' (ciclo R5), o
 *                     la misma categoría ya había aparecido en un reporte
 *                     ANTERIOR (recurrencia real, no promesa).
 *
 * Regla de voz: copy llano de evidencia (pattern-ceremony-plain-copy),
 * nunca clínico, nunca porcentajes de confianza.
 */

export type FindingArcStage = 'encontrado' | 'investigando' | 'confirmado'

/** Los 4 pasos del arco, en orden, para la visual de la card. */
export const FINDING_ARC_STEPS = [
  'Observado',
  'Encontrado',
  'En seguimiento',
  'Confirmado',
] as const

/** Índice del paso activo (0-based sobre FINDING_ARC_STEPS). "Observado"
 *  siempre quedó atrás: un hallazgo solo existe porque hubo observación. */
export function findingArcIndex(stage: FindingArcStage): number {
  return stage === 'confirmado' ? 3 : stage === 'investigando' ? 2 : 1
}

/** La línea de estado, en humano. Evidencia llana, sin promesas. */
export const FINDING_ARC_LABEL: Record<FindingArcStage, string> = {
  encontrado: 'Encontrado este mes',
  investigando: 'Lo estamos siguiendo',
  confirmado: 'Confirmado: también apareció en tu historia',
}

/**
 * Deriva el estado del arco de UN hallazgo.
 * `priorCategories` = categorías de findings de un reporte ANTERIOR
 * persistido (monthly_reports); vacío si no hay historia todavía.
 */
export function findingArcStage(
  finding: Pick<Finding, 'id' | 'category'>,
  report: Pick<MonthlyReport, 'stories' | 'hypotheses'>,
  priorCategories: readonly FindingCategory[],
): FindingArcStage {
  const stories = report.stories ?? []
  const touchesFinding = (h: { sourceFindingId?: string; sourceStoryId?: string }): boolean => {
    if (h.sourceFindingId === finding.id) return true
    if (h.sourceStoryId == null) return false
    const s = stories.find((x) => x.id === h.sourceStoryId)
    return s != null && s.findingIds.includes(finding.id)
  }

  const hyps = (report.hypotheses ?? []).filter(touchesFinding)
  // Confirmación por ciclo de hipótesis (R5) o por recurrencia real en la
  // historia persistida — lo que llegue primero.
  if (hyps.some((h) => h.status === 'confirmed') || priorCategories.includes(finding.category)) {
    return 'confirmado'
  }
  if (hyps.some((h) => h.status === 'open' || h.status === 'experimenting')) {
    return 'investigando'
  }
  return 'encontrado'
}
