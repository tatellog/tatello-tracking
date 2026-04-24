import type { QueryClient } from '@tanstack/react-query'

import type { BriefContext } from '@/features/brief/api'
import { queryKeys } from '@/lib/queryKeys'

export type BriefCacheSnapshot = {
  previous: [readonly unknown[], unknown][]
}

/*
 * Apply a pure transform to every cached BriefContext under
 * queryKeys.brief.*. Returns a snapshot that restoreBriefCache can
 * feed back on error. Shared by every optimistic-update mutation
 * that touches the brief (streak toggle, meal create/update/delete,
 * mood if it ever needs rollback).
 *
 * Why lib and not features/brief: because the helpers are used by
 * mutations that live in *other* features (streak, macros). Keeping
 * them co-located with brief would re-create the cross-feature
 * coupling we just eliminated.
 */
export function patchBriefCache(
  qc: QueryClient,
  transform: (ctx: BriefContext) => BriefContext,
): BriefCacheSnapshot {
  const previous = qc.getQueriesData<BriefContext>({ queryKey: queryKeys.brief.all })
  qc.setQueriesData<BriefContext>({ queryKey: queryKeys.brief.all }, (ctx) => {
    if (!ctx) return ctx
    return transform(ctx)
  })
  return { previous: previous as [readonly unknown[], unknown][] }
}

export function restoreBriefCache(qc: QueryClient, snapshot: BriefCacheSnapshot | undefined) {
  if (!snapshot) return
  for (const [key, data] of snapshot.previous) {
    qc.setQueryData(key, data)
  }
}
