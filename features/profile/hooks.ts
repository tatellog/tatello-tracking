import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getProfile, insertInitialWeight, updateProfile, type ProfileUpdate } from './api'

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
