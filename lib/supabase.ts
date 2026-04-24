import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

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
const storage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
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
    // Magic-link deep links come in via expo-linking; we parse them
    // manually in the auth screen and call setSession. Turning this
    // off stops supabase-js from trying to read window.location on
    // native (no-op today, forward-compat).
    detectSessionInUrl: false,
  },
})

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
