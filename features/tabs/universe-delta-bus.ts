import type { UniverseAttributeKey } from './universe-rewards'

/*
 * Bus mínimo para la recompensa inmediata del universo: cuando un
 * atributo SUBE (detectado en TodayUniverseRewards, la única fuente de
 * verdad del cálculo), se emite {atributo, +delta} y el
 * UniverseDeltaToast montado en el tabs layout lo muestra — sin
 * importar desde qué pantalla se registró (QuickLog, escaneo, sliders).
 * Reemplaza al ignitionBus de frases: un solo sistema de toast.
 */
export type UniverseDelta = { key: UniverseAttributeKey; delta: number }

type Listener = (event: UniverseDelta) => void

const listeners = new Set<Listener>()

/** Anuncia que un atributo del universo subió `delta` puntos pct. */
export function emitUniverseDelta(event: UniverseDelta): void {
  listeners.forEach((fn) => fn(event))
}

/** Suscribe al toast (u otros oyentes); devuelve el unsubscribe. */
export function subscribeUniverseDelta(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
