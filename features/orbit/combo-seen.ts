/*
 * Los patrones que ya se le mostraron a esta usuaria. Alimenta la histéresis
 * de winningCombo junto con combosBornRecently: un patrón mostrado sigue vivo
 * mientras conserve su vara de permanencia, aunque haya nacido hace más de dos
 * semanas. Si deja de cumplirla, se desvanece.
 *
 * Vive en la base (tabla seen_combos, dueña 1 oct 2026): antes solo estaba en
 * el teléfono y un dispositivo nuevo (el Android junto al iPhone) no recordaba
 * el patrón y mostraba otra cosa. El teléfono queda como respaldo sin red, y
 * lo que ya estaba guardado localmente se sube la primera vez.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'

const KEY = 'stelar.combo-seen'
const storageKey = (uid: string) => `${KEY}:${uid}`
const queryKey = (uid: string) => ['orbit', 'comboSeen', uid] as const

const rowsSchema = z.array(z.object({ combo_key: z.string().min(1).max(64) }))

async function readLocal(uid: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

async function saveRemote(uid: string, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return
  // ON CONFLICT DO NOTHING: marcar dos veces no duplica ni pisa la fecha.
  await supabase.from('seen_combos').upsert(
    keys.map((combo_key) => ({ user_id: uid, combo_key })),
    { onConflict: 'user_id,combo_key', ignoreDuplicates: true },
  )
}

async function readSeen(uid: string): Promise<string[]> {
  const local = await readLocal(uid)
  try {
    const { data, error } = await supabase
      .from('seen_combos')
      .select('combo_key')
      .eq('user_id', uid)
    if (error) throw error
    const remote = rowsSchema.parse(data ?? []).map((r) => r.combo_key)
    // Lo que solo estaba en este teléfono sube a la base (una vez).
    const missing = local.filter((k) => !remote.includes(k))
    if (missing.length > 0) void saveRemote(uid, missing).catch(() => {})
    const all = [...new Set([...remote, ...local])]
    AsyncStorage.setItem(storageKey(uid), JSON.stringify(all)).catch(() => {})
    return all
  } catch {
    // Sin red: el respaldo local mantiene el patrón vivo.
    return local
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
    // Hasta que cargue lo guardado no se marca: escribir antes pisaría la lista.
    if (!uid || data == null || keys.includes(key)) return
    const next = [...keys, key]
    qc.setQueryData(queryKey(uid), next)
    AsyncStorage.setItem(storageKey(uid), JSON.stringify(next)).catch(() => {})
    void saveRemote(uid, [key]).catch(() => {})
  }
  return { keys, mark, ready: data != null }
}
