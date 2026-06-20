import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

/*
 * Flag liviano "compartí mi entreno de hoy" — solo metadato de UX (NO sube
 * nada al servidor, NO guarda la imagen). Guarda la ACCIÓN (save/instagram/
 * more) como string para que el copy honesto sobreviva entre sesiones; la
 * imagen es efímera a propósito (la celebración es del día, el registro
 * permanente vive en la constelación · manifiesto).
 *
 * La clave es por fecha, así que se resetea natural al cambiar de día: la
 * ausencia de confirmación nunca es un reproche (sin rachas ni culpa).
 */
export type ShareAction = 'instagram' | 'save' | 'more'

const ACTIONS: readonly ShareAction[] = ['instagram', 'save', 'more']
const keyFor = (iso: string) => `@app:workout_shared:${iso.slice(0, 10)}`

/** `{ sharedAction, markShared }`. `sharedAction` es null si no se compartió
 *  hoy; si no, la acción real (para el copy honesto). Persiste por día. */
export function useWorkoutSharedToday(iso: string): {
  sharedAction: ShareAction | null
  markShared: (action: ShareAction) => void
} {
  const [sharedAction, setSharedAction] = useState<ShareAction | null>(null)
  const key = keyFor(iso)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(key)
      .then((v) => {
        if (active) setSharedAction(ACTIONS.includes(v as ShareAction) ? (v as ShareAction) : null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [key])

  const markShared = useCallback(
    (action: ShareAction) => {
      setSharedAction(action)
      AsyncStorage.setItem(key, action).catch(() => {})
    },
    [key],
  )

  return { sharedAction, markShared }
}
