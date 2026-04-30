import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import type { PhotoAngle } from './usePhotosToday'

const ANGLES: readonly PhotoAngle[] = ['front', 'side_right', 'side_left', 'back']

/*
 * Tolerance window for treating a cluster of photos as one "set".
 * Most users take all four angles in 5–10 minutes; an hour is
 * generous enough to absorb the corner case of a user who pauses
 * mid-shoot to change clothes or rooms, without merging two
 * legitimately separate sessions.
 */
const SET_TOLERANCE_MS = 60 * 60 * 1000

type Row = {
  taken_at: string
  angle: PhotoAngle
}

/*
 * Returns the epoch-ms timestamp of the most recent COMPLETE photo set
 * (a session containing all four angles within SET_TOLERANCE_MS),
 * or null if the user has never finished a full set. The Home reads
 * this to decide whether to show the 30-day reminder banner.
 *
 * We deliberately return number (not Date) — the TanStack Query
 * persister serialises cached data through JSON.stringify, which
 * collapses Date instances into ISO strings. A consumer expecting a
 * Date would crash on `.getTime is not a function` on the very first
 * cache hydration. Number survives the round-trip cleanly.
 *
 * We pull the last 20 rows ordered by taken_at desc — that's enough
 * headroom to find a complete set even if some angles are
 * duplicated (the user retakes one) without paginating.
 */
export function useLatestPhotoSet() {
  return useQuery({
    queryKey: queryKeys.photos.latestSet(),
    queryFn: async (): Promise<number | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('photos')
        .select('taken_at, angle')
        .eq('user_id', user.id)
        .order('taken_at', { ascending: false })
        .limit(20)
      if (error) throw error

      const rows = (data ?? []) as Row[]
      if (rows.length === 0) return null

      const groups = groupBySet(rows, SET_TOLERANCE_MS)
      const completeSet = groups.find(isCompleteSet)
      if (!completeSet) return null

      return Math.max(...completeSet.map((p) => new Date(p.taken_at).getTime()))
    },
    staleTime: 5 * 60 * 1000,
  })
}

/*
 * Walks rows in descending time and clusters anything within
 * `toleranceMs` of the previous row into the same set. Rows arrive
 * already sorted desc, so a single pass is enough.
 */
function groupBySet(rows: Row[], toleranceMs: number): Row[][] {
  const groups: Row[][] = []
  for (const row of rows) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.length > 0) {
      const lastTime = new Date(lastGroup[lastGroup.length - 1]!.taken_at).getTime()
      const thisTime = new Date(row.taken_at).getTime()
      if (Math.abs(lastTime - thisTime) <= toleranceMs) {
        lastGroup.push(row)
        continue
      }
    }
    groups.push([row])
  }
  return groups
}

function isCompleteSet(rows: Row[]): boolean {
  const angles = new Set(rows.map((r) => r.angle))
  return ANGLES.every((a) => angles.has(a))
}
