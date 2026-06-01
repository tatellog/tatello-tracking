import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { clearAnalyticsCache } from '@/lib/analytics'
import { clearVisitedDayOne } from '@/lib/onboardingFlags'
import { queryPersister } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import {
  deleteAccount,
  getProfile,
  insertInitialWeight,
  recordLastPeriodStart,
  updateProfile,
  uploadAvatar,
  type ProfileUpdate,
} from './api'

/*
 * The profile is read constantly (every wizard step needs the user's
 * name; the Home decides isFirstDay from first_workout_at). It changes
 * rarely. Long staleTime + cache key tied to the user (the row is
 * identified by auth.uid via RLS, so per-user identity is implicit).
 */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: getProfile,
    // In dev: refetch on every mount and treat data as immediately
    // stale, so DB-side edits (date_of_birth, sign-affecting
    // changes) show up on the next reload without nuking
    // AsyncStorage. Prod keeps the 5 min staleTime since the
    // profile rarely changes.
    staleTime: __DEV__ ? 0 : 1000 * 60 * 5,
    refetchOnMount: __DEV__ ? 'always' : true,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ProfileUpdate) => updateProfile(input),
    onSuccess: (profile) => {
      // Replace the cache directly so the next render sees the patched
      // row without a refetch round-trip — the wizard navigates as soon
      // as the mutation settles.
      qc.setQueryData(queryKeys.profile.me(), profile)
    },
  })
}

/*
 * Upload a new profile avatar. Takes a local image URI (from the
 * picker), compresses + uploads it, and patches the profile row. The
 * cache is replaced on success so the avatar updates instantly.
 */
export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uri: string) => uploadAvatar(uri),
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.profile.me(), profile)
    },
  })
}

/*
 * Used only by the weight step of the onboarding wizard. After this
 * runs, the brief context becomes stale (it includes the latest
 * weight via getBriefContext), so we invalidate it.
 */
export function useInsertInitialWeight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (weightKg: number) => insertInitialWeight(weightKg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      qc.invalidateQueries({ queryKey: queryKeys.progress.all })
    },
  })
}

/*
 * Records the user's last period start (onboarding's cycle step, or
 * the Progreso → Tu ciclo editor). The raw event lands in cycle_events.
 * We MUST invalidate the readers: the last-period query has a 5-min
 * staleTime and React Query's RN focus is AppState-based, so a plain
 * back-navigation never refetches it — without this, Tu ciclo keeps
 * showing the empty state right after the user anchors a date.
 */
export function useRecordLastPeriodStart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eventDateIso: string) => recordLastPeriodStart(eventDateIso),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.progress.all })
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}

/*
 * Permanently delete the user's account + all their data (App Store
 * requirement + the "tus datos son tuyos" promise). The server-side
 * teardown runs in the delete-account edge function (api.deleteAccount);
 * once it succeeds the device must be left in the exact same clean state
 * as a sign-out, otherwise the just-deleted user's cached rows / persisted
 * store / visited-day-one flag would bleed into the next sign-in.
 *
 * onSuccess mirrors settings.tsx performSignOut:
 *   1. qc.clear()                  — drop the in-memory query cache
 *   2. queryPersister.removeClient — drop the AsyncStorage-persisted cache
 *   3. clearVisitedDayOne()        — reset the Day One flag
 *   4. supabase.auth.signOut()     — clear the local session (the server
 *                                    session is already gone, but the
 *                                    device still holds tokens to wipe)
 *
 * The mutation exposes the standard surface (mutate, isPending, error).
 * Navigation (router.replace('/auth')) belongs to the screen that calls
 * this — the hook stays UI-free. analytics fires before teardown so the
 * event isn't lost when the cache is cleared.
 */
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deleteAccount(),
    onSuccess: async () => {
      // No analytics insert here — the user's analytics_events rows were
      // just deleted server-side; an insert would race the deletion. We
      // only drop the cached is_beta flag so it can't bleed to the next
      // sign-in on this device.
      clearAnalyticsCache()
      qc.clear()
      await Promise.all([
        Promise.resolve(queryPersister.removeClient()).catch(() => {}),
        clearVisitedDayOne().catch(() => {}),
      ])
      // The server already deleted the auth user; this clears the local
      // session + tokens. Errors here are non-fatal — the account is gone
      // regardless — so we swallow them rather than fail the mutation.
      await supabase.auth.signOut().catch(() => {})
    },
  })
}
