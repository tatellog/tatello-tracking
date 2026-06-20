/*
 * Bus mínimo para la celebración full-screen de "Entrené" (el flash dorado).
 *
 * El flash se monta GLOBAL en el (tabs) layout, después de <Tabs>, para que
 * cubra toda la pantalla INCLUYENDO la barra de tabs (antes vivía dentro de la
 * pantalla Hoy y se cortaba arriba de la tab bar). Hoy emite por aquí al marcar
 * "Entrené"; el overlay global lo reproduce. Mismo patrón que universe-delta-bus.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/** Dispara la celebración full-screen (flash dorado). */
export function emitCelebrate(): void {
  listeners.forEach((fn) => fn())
}

/** Suscribe el overlay global; devuelve el unsubscribe. */
export function subscribeCelebrate(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
