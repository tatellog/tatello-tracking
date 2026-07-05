import { useEffect } from 'react'

import { useHasAnySignals } from '@/features/orbit/hooks'
import type { NotificationWindow } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'

import { syncNextStarInvite, syncWeekSealInvite } from './scheduler'

/*
 * Monta el scheduler de las invitaciones: en cada sesión (y cada vez que la
 * ventana elegida cambie desde onboarding o Ajustes) re-agenda (a) la única
 * invitación de mañana y (b) la cita del lunes (el sello de semana, solo
 * con datos). Ver invite.ts para la mecánica de auto-capado.
 */
export function useNextStarInvite(): void {
  const { data: profile } = useProfile()
  const hasAny = useHasAnySignals()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined

  useEffect(() => {
    // undefined = perfil aún cargando: no cancelar lo agendado por un
    // estado transitorio. null/'not_yet' sí sincronizan (cancelan).
    if (window === undefined) return
    void syncNextStarInvite(window)
  }, [window])

  useEffect(() => {
    if (window === undefined || hasAny.data === undefined) return
    void syncWeekSealInvite(window, hasAny.data === true)
  }, [window, hasAny.data])
}
