/*
 * Buzón + bus para "abrir Hoy y celebrar el entreno que trajo el reloj" — el
 * tap de la notificación "Entreno registrado" (features/notifications/
 * workout-arrived.ts). Mismo patrón que pending-calendar-day: `subscribe`
 * reacciona al instante si Hoy ya está montado; `consume` es respaldo si la
 * petición llegó antes de que Hoy existiera (cold start desde la notificación).
 */
type Listener = (date: string) => void

let pending: string | null = null
const listeners = new Set<Listener>()

/** ISO 'YYYY-MM-DD' del día del entreno. */
export function requestWatchCelebration(date: string): void {
  pending = date
  listeners.forEach((fn) => fn(date))
}

export function consumeWatchCelebration(): string | null {
  const p = pending
  pending = null
  return p
}

export function subscribeWatchCelebration(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
