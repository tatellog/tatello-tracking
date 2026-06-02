import { type DimensionKey } from './logic'

/*
 * A tiny decoupled bus for the "encendiste algo en tu cielo" toast. Any
 * register site (a meal re-log, etc.) can fire it without threading a
 * callback or context down — it just emits a dimension key, and the
 * single IgnitionToast mounted in the tabs layout shows the celebration.
 */
type Listener = (key: DimensionKey) => void

const listeners = new Set<Listener>()

/** Fire the celestial toast for a freshly-registered dimension. */
export function igniteDimension(key: DimensionKey): void {
  listeners.forEach((fn) => fn(key))
}

/** Subscribe to ignition events; returns an unsubscribe fn. */
export function subscribeIgnition(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
