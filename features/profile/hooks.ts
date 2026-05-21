import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import {
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
    staleTime: 1000 * 60 * 5,
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
 * Records the user's last period start during the onboarding's
 * tu-ciclo step. The raw event lands in cycle_events; downstream
 * features that read cycles will pick it up via their own query
 * keys, so we don't pre-invalidate anything here.
 */
export function useRecordLastPeriodStart() {
  return useMutation({
    mutationFn: (eventDateIso: string) => recordLastPeriodStart(eventDateIso),
  })
}
