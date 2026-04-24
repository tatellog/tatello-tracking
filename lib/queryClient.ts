import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'

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
 * from the theme store (`tracking-app.theme`) and the Supabase auth
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
  key: 'tracking-app.query-cache',
})

export const QUERY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000
