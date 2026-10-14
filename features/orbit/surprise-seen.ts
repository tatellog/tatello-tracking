/*
 * Qué hallazgos de "Lo que no sabías" ya se revelaron a esta usuaria (ST-006):
 * la PRIMERA apertura es el momento "Nuevo patrón encontrado" (anillo que se
 * llena, conteo, chispas); las siguientes, el detalle tranquilo. Vive solo en
 * el teléfono: si se pierde, lo peor es ver la revelación otra vez. No toca
 * `seen_combos` (eso alimenta la permanencia del combo, otra cosa).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

const storageKey = (uid: string) => `stelar.surprise-reveal-seen:${uid}`

export function useSurpriseRevealSeen(uid: string | null): {
  isNew: (id: string) => boolean
  markSeen: (id: string) => void
} {
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (!uid) return
    let alive = true
    AsyncStorage.getItem(storageKey(uid))
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : []
        const ids = Array.isArray(parsed)
          ? parsed.filter((x): x is string => typeof x === 'string')
          : []
        if (alive) setSeen(new Set(ids))
      })
      .catch(() => {
        if (alive) setSeen(new Set())
      })
    return () => {
      alive = false
    }
  }, [uid])

  return {
    // Mientras no se lee el almacén, nada es "nuevo" (no se festeja de más).
    isNew: (id) => seen != null && !seen.has(id),
    markSeen: (id) => {
      if (!uid || seen == null || seen.has(id)) return
      const next = new Set(seen)
      next.add(id)
      setSeen(next)
      AsyncStorage.setItem(storageKey(uid), JSON.stringify([...next])).catch(() => {})
    },
  }
}
