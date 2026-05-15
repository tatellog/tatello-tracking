import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'

import { supabase } from './supabase'

/*
 * TanStack Query configuration for the app.
 *
 * Defaults favour calm over eager:
 *   - staleTime 5 min: screens re-render from cache without refetching
 *     on every focus. The morning brief only really changes when the
 *     user logs a workout or a measurement, not on tab switches.
 *   - gcTime 24 h: cached payloads survive background + resume cycles
 *     so reopening the app after a break still paints instantly.
 *   - retry 1: one quiet retry on transient errors; after that, the UI
 *     surfaces an error state instead of thrashing the network.
 *
 * The cache persists to AsyncStorage under a dedicated key, separate
 * from the theme store (`stelar.theme`) and the Supabase auth
 * session (expo-secure-store). maxAge matches gcTime so rehydration
 * never restores stuff older than the in-memory policy would keep.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'stelar.query-cache',
})

export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000

/*
 * AsyncStorage key that stores the auth user id seen on the most
 * recent app boot. RouteGuard compares it against the current
 * session — when a different user signs in (or signs in fresh on
 * a device that has another user's persisted cache), the cache is
 * keyed against THIS user, not the previous one.
 *
 * Without this, query keys like ['profile', 'me'] are identical
 * across users, so the persister hands back the previous user's
 * profile to a freshly signed-in user. The user briefly sees stale
 * data and — worse — RouteGuard reads a non-null
 * onboarding_completed_at and skips the wizard entirely.
 */
export const LAST_AUTH_USER_KEY = 'stelar.last-auth-user-id'

/*
 * Module-level auth subscriber that flushes the query cache the
 * moment supabase reports a different auth user than the previous
 * event. Critical that this runs OUTSIDE the React component tree:
 *   - React effect order is bottom-up (children before parents),
 *     so a cache-clear effect placed in RootLayout fires AFTER
 *     RouteGuard has already read stale cached data and routed the
 *     user to the wrong screen.
 *   - supabase fires INITIAL_SESSION / SIGNED_IN / SIGNED_OUT /
 *     TOKEN_REFRESHED at well-defined points; subscribing here means
 *     the cache is empty by the time any query hook mounts.
 *
 * Tri-state lastAuthUserId: `undefined` until the first event,
 * `null` when no user is signed in, otherwise the user's id. The
 * first event never triggers a clear (initial state is the source
 * of truth, not a transition).
 */
let lastAuthUserId: string | null | undefined = undefined
supabase.auth.onAuthStateChange((_event, session) => {
  const newUserId = session?.user?.id ?? null
  if (lastAuthUserId !== undefined && lastAuthUserId !== newUserId) {
    queryClient.clear()
    Promise.resolve(queryPersister.removeClient()).catch(() => {})
  }
  lastAuthUserId = newUserId
})
