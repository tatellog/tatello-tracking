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

/**
 * Date al mediodía local de un 'YYYY-MM-DD' — construida POR COMPONENTES, no
 * desde string. Hermes (motor JS de RN) devuelve Invalid Date para
 * `new Date('2026-06-02T12:00:00')`; el constructor numérico es fiable. Mediodía
 * para que el meal_date no cruce de día por la zona horaria.
 */
export function dayNoon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12, 0, 0)
}
