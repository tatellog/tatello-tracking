import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { AppState, Platform } from 'react-native'

import type { Database } from '@/types/database.types'

/*
 * Supabase storage adapter.
 *
 *   Native (iOS / Android) → expo-secure-store, which writes to the
 *     iOS keychain and Android EncryptedSharedPreferences. Session
 *     tokens are at-rest encrypted and survive reinstall.
 *   Web                    → AsyncStorage (localStorage under the hood).
 *     SecureStore isn't available in browsers; localStorage matches
 *     the platform's standard auth-token pattern.
 *
 * The two paths share the same async getItem/setItem/removeItem
 * shape so supabase-js treats them interchangeably.
 */
// AFTER_FIRST_UNLOCK: el default del keychain (WHEN_UNLOCKED) deja de
// leerse con la pantalla bloqueada o la app en background — justo cuando
// corre el auto-refresh de supabase-js → "User interaction is not
// allowed". Tras el primer desbloqueo del día el token sigue legible,
// que es lo único que el refresh necesita. (Aplica a escrituras nuevas:
// el token viejo se reescribe solo en el siguiente refresh desbloqueado.)
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

const storage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key, secureStoreOptions),
        setItem: (key: string, value: string) =>
          SecureStore.setItemAsync(key, value, secureStoreOptions),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key, secureStoreOptions),
      }

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill in values, then restart Metro.',
  )
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // On native we parse the deep link manually in
    // useMagicLinkHandler (expo-linking gives us the URL on cold
    // start and on resume). On web we let supabase-js read
    // window.location.hash itself — it strips the fragment after
    // exchanging the tokens, so the route guard re-runs against a
    // clean URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
})

// supabase-js refresca el token en un intervalo fijo aunque la app esté
// dormida. Atarlo a AppState evita que el tick corra con la pantalla
// apagada (el origen del error de keychain "User interaction is not
// allowed") y ahorra trabajo en segundo plano. Receta oficial de
// Supabase para React Native.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh()
    } else {
      supabase.auth.stopAutoRefresh()
    }
  })
}

/*
 * Resolve the authenticated user's id for INSERT/UPDATE/DELETE paths
 * that need to set user_id explicitly (RLS policies enforce
 * auth.uid() = user_id). Throws a clear error when called without a
 * session so the caller surfaces "please log in" instead of a
 * supabase-js null-dereference further down.
 */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}
