import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

export type PhotoAngle = 'front' | 'side_right' | 'side_left' | 'back'

export type TodayPhoto = {
  id: string
  angle: PhotoAngle
  storage_path: string
  taken_at: string
  signed_url: string | null
}

/*
 * Fetches the photos taken today (user-local midnight) plus a signed
 * URL for each so the Día 1 PhotoCaptureCard can render thumbnails.
 *
 * Runs in two waves: the metadata query (cheap, RLS-scoped to the
 * caller via auth.uid()) and one signed-url request per photo. We
 * intentionally don't parallelise into a single RPC — keeping the
 * URL signing on the storage SDK lets us reuse the same TTL/policy
 * in future surfaces (gallery, reminder banner) without forking the
 * metadata path.
 */
export function usePhotosToday() {
  return useQuery({
    queryKey: queryKeys.photos.today(),
    queryFn: async (): Promise<TodayPhoto[]> => {
      const auth = await supabase.auth.getUser()
      const user = auth.data.user
      if (!user) return []

      const start = new Date()
      start.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('photos')
        .select('id, angle, storage_path, taken_at')
        .eq('user_id', user.id)
        .gte('taken_at', start.toISOString())
        .order('taken_at', { ascending: false })

      if (error) throw error

      const rows = data ?? []
      const withUrls = await Promise.all(
        rows.map(async (row) => {
          const { data: signed } = await supabase.storage
            .from('progress-photos')
            .createSignedUrl(row.storage_path, 60 * 60)
          return {
            id: row.id,
            angle: row.angle as PhotoAngle,
            storage_path: row.storage_path,
            taken_at: row.taken_at,
            signed_url: signed?.signedUrl ?? null,
          }
        }),
      )
      return withUrls
    },
    staleTime: 60_000,
  })
}
