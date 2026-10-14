/*
 * El recorrido de un hallazgo, medido (ST-008 · plan §2): calificado →
 * presentado → abierto. Puro: qué se manda y cuándo se repite.
 *
 * - `insight_eligible`: el motor lo calificó (lo que pinta el feed de Descubre).
 *   Una vez al día por hallazgo.
 * - `insight_presented`: estuvo en pantalla con su tab a la vista. Una vez al
 *   día por hallazgo y superficie (Hoy / Descubre).
 * - `insight_opened`: lo abriste a propósito. Cada apertura cuenta.
 *
 * Solo ids y etiquetas: la metadata NUNCA lleva lo que comes, pesas o duermes.
 * track() ya filtra beta y el interruptor de Ajustes.
 */
import type { EvidenceLabel } from './evidence-label'
import type { FeaturedDiscovery } from './featured-discovery'

export type InsightSurface = 'hoy' | 'descubre'
/** De dónde vino la apertura: la superficie, o el push N9. */
export type InsightFrom = InsightSurface | 'push'
/** Qué se abrió: el detalle de la sorpresa, la evidencia de un patrón, el
 *  reveal del combo, o (combo desde Hoy) su tarjeta, que encabeza el feed. */
export type InsightTarget = 'surprise_detail' | 'evidence' | 'combo_reveal' | 'feed_card'
export type DedupedInsightEvent = 'insight_eligible' | 'insight_presented'

export type InsightMeta = {
  /** Separa estos eventos de los de lecturas (que usan `source` propio). */
  source: 'discovery'
  finding_id: string
  kind: FeaturedDiscovery['kind']
  label: EvidenceLabel
  stage: number
}

export function insightMeta(
  d: FeaturedDiscovery,
  label: EvidenceLabel,
  stage: number,
): InsightMeta {
  return { source: 'discovery', finding_id: d.id, kind: d.kind, label, stage }
}

/** Llave → día local del último envío. Solo guarda el día de hoy. */
export type InsightLedger = Record<string, string>

export function insightKey(
  event: DedupedInsightEvent,
  id: string,
  surface?: InsightSurface,
): string {
  return surface ? `${event}:${surface}:${id}` : `${event}:${id}`
}

export function shouldSendToday(ledger: InsightLedger, key: string, today: string): boolean {
  return ledger[key] !== today
}

/** Anota el envío y suelta lo de días anteriores (la dedupe es por día). */
export function markSentToday(ledger: InsightLedger, key: string, today: string): InsightLedger {
  const next: InsightLedger = {}
  for (const [k, day] of Object.entries(ledger)) if (day === today) next[k] = day
  next[key] = today
  return next
}
