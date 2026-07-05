import Constants from 'expo-constants'
import { Platform } from 'react-native'

import type { NotificationWindow } from '@/features/profile/api'

import { INVITE_COPY, nextInviteDate, nextSealDate, SEAL_COPY } from './invite'

/*
 * El scheduler de la invitación — el lado imperativo (expo-notifications).
 * Salda la deuda que dejó onboarding/notifications.tsx: la preferencia
 * (`notification_window`) ya se guardaba y el permiso del OS ya se pedía,
 * pero nadie agendaba nada.
 *
 * Reglas:
 *   · 'not_yet' / sin ventana → cancela lo agendado y no agenda (su "no"
 *     es su ritmo; el re-ask suave vive en Ajustes, no aquí).
 *   · El permiso del OS se consulta en RUNTIME (como pedía el comentario
 *     de deuda) — sin permiso, cancela y sale en silencio. Sin regaños.
 *   · Identifier fijo → idempotente: re-agendar reemplaza, nunca acumula.
 *   · Expo Go no tiene el módulo nativo → no-op (mismo guard + import
 *     dinámico que onboarding).
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient'

/** Un solo slot de invitación — re-agendar SIEMPRE reemplaza. */
export const INVITE_ID = 'stelar-next-star-invite'

export async function syncNextStarInvite(
  window: NotificationWindow | null | undefined,
): Promise<void> {
  if (isExpoGo) return
  try {
    // Import dinámico: mantiene expo-notifications fuera del module-eval
    // (mismo patrón que onboarding/notifications.tsx).
    const Notifications = await import('expo-notifications')

    await Notifications.cancelScheduledNotificationAsync(INVITE_ID).catch(() => {})
    if (window == null || window === 'not_yet') return

    const perm = await Notifications.getPermissionsAsync()
    if (perm.status !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Stelar',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    await Notifications.scheduleNotificationAsync({
      identifier: INVITE_ID,
      content: { title: INVITE_COPY.title, body: INVITE_COPY.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextInviteDate(new Date(), window),
      },
    })
  } catch {
    // Una invitación que no se pudo agendar jamás debe romper la app.
  }
}

/** El slot del sello del lunes — igual de idempotente. */
export const SEAL_ID = 'stelar-week-seal-invite'

/**
 * La cita del lunes (Fase 7): una notificación local para el PRÓXIMO lunes
 * en la ventana elegida, invitando a ver la semana sellada en Órbita.
 * `hasData` la gatea: a una usuaria sin ningún registro no se le promete
 * un sello que no existe. Mismas reglas que la invitación diaria
 * (not_yet cancela, permiso en runtime, no-op en Expo Go).
 */
export async function syncWeekSealInvite(
  window: NotificationWindow | null | undefined,
  hasData: boolean,
): Promise<void> {
  if (isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')

    await Notifications.cancelScheduledNotificationAsync(SEAL_ID).catch(() => {})
    if (window == null || window === 'not_yet' || !hasData) return

    const perm = await Notifications.getPermissionsAsync()
    if (perm.status !== 'granted') return

    await Notifications.scheduleNotificationAsync({
      identifier: SEAL_ID,
      content: { title: SEAL_COPY.title, body: SEAL_COPY.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextSealDate(new Date(), window),
      },
    })
  } catch {
    // Nunca romper la app por una notificación.
  }
}
