/*
 * Los patrones que ya se le mostraron a esta usuaria (por uid, en el teléfono).
 * Alimenta la histéresis de winningCombo junto con combosBornRecently: un patrón
 * mostrado sigue vivo mientras conserve su vara de permanencia, aunque haya
 * nacido hace más de dos semanas. Si deja de cumplirla, se desvanece.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'

const KEY = 'stelar.combo-seen'
const storageKey = (uid: string) => `${KEY}:${uid}`
const queryKey = (uid: string) => ['orbit', 'comboSeen', uid] as const

async function readSeen(uid: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function useSeenCombos(uid: string | null) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: uid ? queryKey(uid) : ['orbit', 'comboSeen', 'off'],
    queryFn: () => (uid ? readSeen(uid) : Promise.resolve<string[]>([])),
    enabled: uid != null,
    staleTime: Infinity,
  })
  const keys = data ?? []
  const mark = (key: string) => {
    if (!uid || keys.includes(key)) return
    const next = [...keys, key]
    qc.setQueryData(queryKey(uid), next)
    AsyncStorage.setItem(storageKey(uid), JSON.stringify(next)).catch(() => {})
  }
  return { keys, mark }
}
