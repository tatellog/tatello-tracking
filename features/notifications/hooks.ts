import { useEffect } from 'react'

import { useMealsForDate } from '@/features/macros/hooks'
import { useHasAnySignals } from '@/features/orbit/hooks'
import type { NotificationWindow } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { todayInTimezone } from '@/lib/time'

import { syncDayCloseInvite, syncNextStarInvite, syncWeekSealInvite } from './scheduler'

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

/*
 * La cita del cierre: reacciona a las comidas de HOY (misma query cacheada
 * que pinta Comidas, cero fetch extra). Primera comida del día → se agenda
 * el push de las 20:15; día sin comida → se cancela. El push solo existe
 * en días que lo GANARON, así que nunca es reproche.
 *
 * `hasAny` alimenta el arbitraje 1/día: el lunes que el sello es elegible,
 * el cierre cede (misma query cacheada que ya usa useNextStarInvite).
 */
export function useDayCloseInvite(): void {
  const { data: profile } = useProfile()
  const hasAny = useHasAnySignals()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined
  const meals = useMealsForDate(todayInTimezone())
  const mealCount = meals.data?.length

  useEffect(() => {
    if (window === undefined || mealCount === undefined || hasAny.data === undefined) return
    void syncDayCloseInvite(window, mealCount > 0, hasAny.data === true)
  }, [window, mealCount, hasAny.data])
}
