import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

/*
 * Ventana de "primera vez" — devuelve true mientras estemos DENTRO de los
 * primeros `windowMs` desde que la usuaria vio algo por primera vez. La
 * primera lectura siembra el timestamp; a partir de ahí compara contra
 * ahora. Sirve para susurros de bienvenida que introducen una regla sin
 * tutorial y se DESVANECEN solos (manifiesto: se siente, no se enseña).
 *
 * Empieza en false (mientras resuelve AsyncStorage) → el susurro nunca
 * parpadea antes de saber si toca mostrarlo. Falla en silencio: un susurro
 * es pulido, jamás bloquea el render.
 */
export function useFirstSeenWindow(key: string, windowMs: number): boolean {
  const [within, setWithin] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(key)
        const now = Date.now()
        if (stored == null) {
          // Primera vez: siembra el sello y muestra el susurro hoy.
          AsyncStorage.setItem(key, String(now)).catch(() => {})
          if (active) setWithin(true)
        } else if (active) {
          setWithin(now - Number(stored) < windowMs)
        }
      } catch {
        // Silencio — el susurro es opcional, nunca rompe la pantalla.
      }
    })()
    return () => {
      active = false
    }
  }, [key, windowMs])

  return within
}
