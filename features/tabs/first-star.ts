import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

import { useHasAnySignals } from '@/features/orbit/hooks'
import { useSession } from '@/hooks/useSession'

/*
 * Micro-ceremonia de la PRIMERA estrella — el "aha" del minuto 1.
 *
 * Detecta el momento exacto en que la usuaria pasa de "nunca registré nada"
 * a "mi primer registro" CON Hoy montado, una sola vez en la vida:
 *
 *   1. Se ARMA solo si observó `hasAnySignals === false` en esta sesión
 *      (usuaria genuinamente nueva). Esto evita falsos disparos por orden
 *      de carga de queries y excluye a usuarias existentes tras el update.
 *   2. Cuando `todayHasRegistro` enciende estando armada → dispara UNA vez
 *      y persiste el flag para no repetirse jamás (ni en otro mes, ni al
 *      reinstalar la sesión).
 *
 * El flag va scopeado por usuaria: en un dispositivo compartido, la
 * ceremonia de una no se la come a la otra (memoria: cross-user leak).
 * La UI (haptic + fuegos + línea del coach) vive en Hoy; aquí solo el
 * cuándo.
 */

const keyFor = (uid: string) => `@app:first_star_celebrated:${uid}`

export function useFirstStarCeremony(todayHasRegistro: boolean): boolean {
  const uid = useSession().session?.user?.id ?? 'anon'
  const hasAny = useHasAnySignals()

  // null = aún no leímos AsyncStorage; true/false = ya sabemos.
  const [alreadyCelebrated, setAlreadyCelebrated] = useState<boolean | null>(null)
  const [armed, setArmed] = useState(false)
  const [fired, setFired] = useState(false)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(keyFor(uid))
      .then((v) => {
        if (active) setAlreadyCelebrated(v != null)
      })
      .catch(() => {
        // Sin lectura confiable, mejor NO celebrar que celebrar doble.
        if (active) setAlreadyCelebrated(true)
      })
    return () => {
      active = false
    }
  }, [uid])

  // Armado: vimos con certeza que la usuaria nunca ha registrado nada.
  useEffect(() => {
    if (hasAny.data === false && alreadyCelebrated === false) setArmed(true)
  }, [hasAny.data, alreadyCelebrated])

  // Disparo: primer registro en vivo. Una vez, para siempre.
  useEffect(() => {
    if (!armed || fired || !todayHasRegistro) return
    setFired(true)
    AsyncStorage.setItem(keyFor(uid), new Date().toISOString()).catch(() => {})
  }, [armed, fired, todayHasRegistro, uid])

  return fired
}
