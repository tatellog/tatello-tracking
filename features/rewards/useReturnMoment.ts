import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { pickReturnPhrase, shouldCelebrateReturn } from './logic'

/*
 * El estado "¿cuándo te vi por última vez?" del momento de Regreso.
 * LOCAL (AsyncStorage, como '@app:water_goal_ml') — es un detalle de
 * presentación del dispositivo, no un dato del modelo: no necesita
 * round-trip ni sobrevivir reinstalaciones.
 */
const KEY = '@app:last_seen_day'

/**
 * Devuelve la frase de regreso a mostrar (o null) para el día local
 * `todayIso` (ctx.date — ya en la zona del usuario, no new Date()).
 *
 * Orden importante: persiste HOY antes de decidir si celebra. Así el
 * momento es idempotente — un remount (ErrorBoundary, dev reload) ve
 * gap 0 y no lo repite; y el primer uso de la vida (sin lastSeen) solo
 * siembra la fecha, sin celebrar un regreso que no existió.
 */
export function useReturnMoment(todayIso: string): {
  phrase: string | null
  dismiss: () => void
} {
  const [phrase, setPhrase] = useState<string | null>(null)
  const checkedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!todayIso || checkedFor.current === todayIso) return
    checkedFor.current = todayIso
    let cancelled = false
    AsyncStorage.getItem(KEY)
      .then((lastSeen) => {
        AsyncStorage.setItem(KEY, todayIso).catch(() => {})
        if (cancelled) return
        if (shouldCelebrateReturn(lastSeen, todayIso)) {
          setPhrase(pickReturnPhrase(todayIso))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [todayIso])

  const dismiss = useCallback(() => setPhrase(null), [])

  return { phrase, dismiss }
}
