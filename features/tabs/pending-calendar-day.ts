/*
 * Buzón + bus para "abrir Hoy en una fecha y mostrar su detalle" — hoy, desde
 * el CTA "Ver día →" del bottom sheet de Historia (Tab Progreso). Progreso
 * OBSERVA; cuando la usuaria quiere editar, este bus la lleva a Hoy (que OPERA)
 * con la fecha ya seleccionada y scrolleada al DayDetailPanel.
 *
 * Es la ÚNICA puerta de Progreso → edición: un solo lugar para editar un dato.
 *
 * Doble vía (mismo patrón que pending-universe-detail): `subscribe` reacciona
 * al instante si Hoy ya está montado (lo está: detachInactiveScreens=false), y
 * `consume` es respaldo si la petición llegó antes de que existiera el oyente.
 */
type Listener = (date: string) => void

let pending: string | null = null
const listeners = new Set<Listener>()

/** ISO 'YYYY-MM-DD'. */
export function requestCalendarDay(date: string): void {
  pending = date
  listeners.forEach((fn) => fn(date))
}

export function consumeCalendarDay(): string | null {
  const p = pending
  pending = null
  return p
}

export function subscribeCalendarDayRequest(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
