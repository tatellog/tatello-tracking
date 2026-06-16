/*
 * Bus mínimo para abrir el QuickLogSheet (✦) desde fuera de la tab bar —
 * hoy, desde el chip "Agua" del checklist "Tu día" (el agua solo se registra
 * en la hoja ✦, no en una sección de Hoy). El sheet vive permanentemente en
 * la tab bar con su propio estado `visible`; el chip deja la petición aquí y
 * la tab bar la consume abriéndolo.
 *
 * Sin `consume` de respaldo: la tab bar está SIEMPRE montada, así que el
 * `subscribe` basta (a diferencia de pending-universe-detail, cuyo oyente —
 * Hoy — podía no existir al llegar la petición).
 */
type Listener = () => void

const listeners = new Set<Listener>()

export function requestQuickLog(): void {
  listeners.forEach((fn) => fn())
}

export function subscribeQuickLogRequest(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
