import type { UniverseAttributeKey } from './universe-rewards'

/*
 * Buzón + bus para abrir el detalle de un atributo del universo desde
 * fuera de "Tu universo hoy" — hoy, desde el tap del toast de delta
 * ("+13 Claridad"). El toast es global (vive en el tabs layout) y el
 * panel de detalle vive en Hoy, así que el toast deja la petición aquí,
 * navega a Hoy, y TodayUniverseRewards la consume (abre ese atributo).
 *
 * Doble vía: `subscribe` para reaccionar al instante si Hoy ya está
 * montado (lo está: detachInactiveScreens=false), y `consume` como
 * respaldo por si la petición llegó antes de que el oyente existiera.
 * Mismo patrón que pending-segment, con bus por inmediatez.
 */
type Listener = (key: UniverseAttributeKey) => void

let pending: UniverseAttributeKey | null = null
const listeners = new Set<Listener>()

export function requestUniverseDetail(key: UniverseAttributeKey): void {
  pending = key
  listeners.forEach((fn) => fn(key))
}

export function consumeUniverseDetail(): UniverseAttributeKey | null {
  const p = pending
  pending = null
  return p
}

export function subscribeUniverseDetailRequest(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
