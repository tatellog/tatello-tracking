import { Redirect } from 'expo-router'
import { type ComponentType } from 'react'

import { useProfile } from '@/features/profile/hooks'

/*
 * Gatea pantallas dev: alcanzables en desarrollo (__DEV__) o para usuarias
 * con profiles.is_dev (server-controlled). Las pantallas dev no escriben a la
 * DB — solo renderizan arte/estado local — pero NO deben ser navegables por
 * deep-link en producción para una usuaria normal (auditoría de seguridad).
 *
 * Se decide tras cargar el perfil (isLoading → null, sin parpadeo). HOC en
 * vez de early-return dentro de la pantalla para no romper el orden de hooks.
 */
export function useDevAllowed(): boolean | null {
  const { data: profile, isLoading } = useProfile()
  if (isLoading) return null
  return __DEV__ || !!profile?.is_dev
}

export function withDevGuard<P extends object>(Screen: ComponentType<P>) {
  return function GuardedDevScreen(props: P) {
    const allowed = useDevAllowed()
    if (allowed === null) return null
    if (!allowed) return <Redirect href="/" />
    return <Screen {...props} />
  }
}
