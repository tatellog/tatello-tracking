/*
 * Store reactivo compartido: la FECHA a la que el botón Registrar (global, en
 * el tab bar, fuera de Hoy) debe escribir. En modo "ver día" Hoy la pone al día
 * visto; al volver a hoy o salir de Hoy se limpia (null = hoy). El QuickLogSheet
 * la lee para hacer BACKFILL de comida/agua al día correcto.
 *
 * Reactivo (useSyncExternalStore) porque el FAB/sheet viven en otro árbol que
 * Hoy: necesitan re-renderizar cuando Hoy cambia el día visto.
 */
import { useSyncExternalStore } from 'react'

let active: string | null = null
const listeners = new Set<() => void>()

/** ISO 'YYYY-MM-DD', o null para "hoy". */
export function setActiveLogDate(date: string | null): void {
  if (active === date) return
  active = date
  listeners.forEach((fn) => fn())
}

function getActiveLogDate(): string | null {
  return active
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useActiveLogDate(): string | null {
  return useSyncExternalStore(subscribe, getActiveLogDate, getActiveLogDate)
}

/*
 * Canal "volver a hoy": la pill global (en el tab bar, fuera de Hoy) pide salir
 * del modo ver-día desde cualquier tab; Hoy escucha y resetea su día visto a
 * hoy (lo que a su vez limpia la fecha activa). Mismo patrón que pending-*.
 */
const returnListeners = new Set<() => void>()

export function requestReturnToToday(): void {
  returnListeners.forEach((fn) => fn())
}

export function subscribeReturnToToday(fn: () => void): () => void {
  returnListeners.add(fn)
  return () => {
    returnListeners.delete(fn)
  }
}
