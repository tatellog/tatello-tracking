/*
 * Fotos privadas por enlace firmado (dueña 28 sep 2026 · auditoría de
 * privacidad): las fotos de comidas y los avatares dejan de servirse por URL
 * pública. Cada imagen pide un enlace firmado que expira en 1 h; React Query lo
 * cachea 50 min y lo renueva antes de que caduque. Funciona con el bucket
 * público o privado, así que la app sirve antes y después de cerrarlo.
 */
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type PrivateBucket = 'meal-photos' | 'avatars'

const TTL_SECONDS = 60 * 60
const FRESH_MS = 50 * 60 * 1000

export async function signedStorageUrl(
  bucket: PrivateBucket,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL_SECONDS)
  if (error || !data?.signedUrl) {
    console.warn('[storage] createSignedUrl failed', { bucket, path, error: error?.message })
    return null
  }
  return data.signedUrl
}

/** El enlace firmado de una foto privada (null mientras carga o sin foto). */
export function useSignedStorageUrl(bucket: PrivateBucket, path: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ['storage', 'signed', bucket, path ?? ''],
    queryFn: () => signedStorageUrl(bucket, path!),
    enabled: !!path,
    staleTime: FRESH_MS,
    gcTime: FRESH_MS,
    refetchOnWindowFocus: false,
  })
  return data ?? null
}
