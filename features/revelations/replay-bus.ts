/*
 * Bus "re-vivir revelación" — desacopla el detalle del día (emisor, anidado en
 * un panel/sheet) del host de la ceremonia full-screen (suscriptor, en la raíz
 * de la pantalla). Tocar el evento de un día re-abre su ceremonia (Patrón /
 * Transformación / Regreso) tal cual se mostró. Mismo patrón que
 * features/orbit/pending-segment.ts y registro-intent.ts.
 *
 * Las ceremonias son `absoluteFill` (no RN <Modal>), así que solo cubren la
 * pantalla si se montan en la raíz — por eso el host vive en la pantalla y el
 * detalle solo emite.
 */
export type ReplayEvent = {
  tier: string
  kind: string
  message: string
  title?: string
  /** La prueba del patrón (frecuencia como evidencia), para la ceremonia. */
  evidence?: string
  /** La misma evidencia en NÚMEROS (count de total) → la tira visual. */
  evidenceCount?: number
  evidenceTotal?: number
  /** Etapa 3: la correlación con el déficit (barras pareadas + su porqué). */
  evidenceBars?: {
    label: string
    value: number
    total?: number
    colorKey?: string
    highlight?: boolean
  }[]
  correlationInsight?: string
  /** La fecha del día desde el que se re-vive (ISO 'YYYY-MM-DD') — la ceremonia
   *  la muestra para dar contexto ("¿de cuándo es esto?"). */
  date?: string
}

type Listener = (e: ReplayEvent) => void

const listeners = new Set<Listener>()

export function emitReplayReveal(event: ReplayEvent): void {
  for (const l of listeners) l(event)
}

export function subscribeReplayReveal(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
