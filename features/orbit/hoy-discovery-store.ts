/*
 * Dónde vive lo que Hoy recuerda de cada hallazgo (`HoyDiscoveryState`): solo
 * en el teléfono. Si se pierde, lo peor es que un hallazgo vuelva a asomar en
 * Hoy unos días. La lógica de "¿se muestra?" es pura (hoy-discovery.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  markHoyDiscoveryOpened,
  markHoyDiscoveryShown,
  type HoyDiscoveryState,
} from './hoy-discovery'

const storageKey = (uid: string) => `stelar.hoy-discovery:${uid}`
const queryKey = (uid: string) => ['orbit', 'hoyDiscovery', uid] as const

async function read(uid: string): Promise<HoyDiscoveryState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid))
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as HoyDiscoveryState) : {}
  } catch {
    return {}
  }
}

async function update(
  uid: string,
  fn: (s: HoyDiscoveryState) => HoyDiscoveryState,
): Promise<HoyDiscoveryState> {
  const prev = await read(uid)
  const next = fn(prev)
  if (next !== prev)
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(next)).catch(() => {})
  return next
}

export function useHoyDiscoveryState(uid: string | null) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: uid ? queryKey(uid) : ['orbit', 'hoyDiscovery', 'off'],
    queryFn: () => read(uid!),
    enabled: uid != null,
    staleTime: Infinity,
  })
  const set = (next: HoyDiscoveryState) => {
    if (uid) qc.setQueryData(queryKey(uid), next)
  }
  return {
    state: q.data ?? null,
    markShown: (id: string, today: string) => {
      if (!uid) return
      void update(uid, (s) => markHoyDiscoveryShown(s, id, today)).then(set)
    },
    markOpened: (id: string) => {
      if (!uid) return
      void update(uid, (s) => markHoyDiscoveryOpened(s, id)).then(set)
    },
  }
}
