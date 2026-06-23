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
export type ReplayEvent = { tier: string; kind: string; message: string }

type Listener = (e: ReplayEvent) => void

const listeners = new Set<Listener>()

export function emitReplayReveal(event: ReplayEvent): void {
  for (const l of listeners) l(event)
}

export function subscribeReplayReveal(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
