/*
 * Bus mínimo para la celebración full-screen de "Entrené".
 *
 * El overlay se monta GLOBAL en el (tabs) layout, después de <Tabs>, para que
 * cubra toda la pantalla INCLUYENDO la barra de tabs. Hoy emite por aquí al
 * marcar "Entrené" (o cuando el entreno llega del reloj) con la posición del
 * emblema en la ventana: la corona de chispas nace de SU anillo. Mismo patrón
 * que universe-delta-bus.
 */

export type CelebratePayload = {
  /** Centro y radio del anillo del emblema, en coordenadas de ventana. */
  cx: number
  cy: number
  r: number
  /** La estrella del corazón del emblema (ventana): ahí regresa el oro. */
  tx: number
  ty: number
  /** Texto de abajo: el hecho y, debajo, la voz del coach. */
  title: string
  subtitle?: string
}

type Listener = (payload: CelebratePayload) => void

const listeners = new Set<Listener>()

/** Dispara la celebración full-screen. */
export function emitCelebrate(payload: CelebratePayload): void {
  listeners.forEach((fn) => fn(payload))
}

/** Suscribe el overlay global; devuelve el unsubscribe. */
export function subscribeCelebrate(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
