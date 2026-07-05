import Constants from 'expo-constants'
import { Platform } from 'react-native'

import type { NotificationWindow } from '@/features/profile/api'

import {
  CLOSE_COPY,
  INVITE_COPY,
  nextInviteDate,
  nextReturnDate,
  nextSealDate,
  RETURN_COPY,
  SEAL_COPY,
  todayCloseDate,
} from './invite'

/** Dónde aterriza el TAP de cada notificación (leído por el response
 *  router en features/notifications/response.ts). Sin destino, el tap
 *  aterrizaba frío en Hoy aunque el copy prometiera el sello de Órbita. */
export type NotificationTarget = 'hoy' | 'orbit-semana'

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
/** La segunda invitación (~7 días). Con INVITE_ID forman el techo del
 *  canal de regreso: DOS toques en total, luego silencio. */
export const RETURN_ID = 'stelar-return-invite'

export async function syncNextStarInvite(
  window: NotificationWindow | null | undefined,
): Promise<void> {
  if (isExpoGo) return
  try {
    // Import dinámico: mantiene expo-notifications fuera del module-eval
    // (mismo patrón que onboarding/notifications.tsx).
    const Notifications = await import('expo-notifications')

    await Notifications.cancelScheduledNotificationAsync(INVITE_ID).catch(() => {})
    await Notifications.cancelScheduledNotificationAsync(RETURN_ID).catch(() => {})
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
      content: {
        title: INVITE_COPY.title,
        body: INVITE_COPY.body,
        data: { target: 'hoy' satisfies NotificationTarget },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextInviteDate(new Date(), window),
      },
    })

    // La red de 7 días: se re-arma junto con la de mañana, así que solo
    // alcanza a quien de verdad pausó una semana. Después de esta, nada.
    await Notifications.scheduleNotificationAsync({
      identifier: RETURN_ID,
      content: {
        title: RETURN_COPY.title,
        body: RETURN_COPY.body,
        data: { target: 'hoy' satisfies NotificationTarget },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextReturnDate(new Date(), window),
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
      content: {
        title: SEAL_COPY.title,
        body: SEAL_COPY.body,
        // El copy promete el sello ("tu cielo la guarda") → el tap aterriza
        // en Órbita Semana, no frío en Hoy.
        data: { target: 'orbit-semana' satisfies NotificationTarget },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextSealDate(new Date(), window),
      },
    })
  } catch {
    // Nunca romper la app por una notificación.
  }
}

/** El slot de la cita del cierre — uno solo, re-agendar reemplaza. */
export const DAY_CLOSE_ID = 'stelar-day-close'

/**
 * La cita nocturna: HOY a las 20:15, SOLO si el día ya tiene ≥1 comida
 * registrada (mismo gate que el veredicto del DayClose: un día sin datos
 * no se juzga y tampoco notifica). Se llama cada vez que las comidas del
 * día cambian; idempotente por identifier. Sin comida → cancela. Después
 * de las 20:15 → no agenda (el cierre tardío se descubre en la app).
 */
export async function syncDayCloseInvite(
  window: NotificationWindow | null | undefined,
  hasMealToday: boolean,
): Promise<void> {
  if (isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')

    await Notifications.cancelScheduledNotificationAsync(DAY_CLOSE_ID).catch(() => {})
    if (window == null || window === 'not_yet' || !hasMealToday) return

    const date = todayCloseDate(new Date())
    if (date == null) return

    const perm = await Notifications.getPermissionsAsync()
    if (perm.status !== 'granted') return

    await Notifications.scheduleNotificationAsync({
      identifier: DAY_CLOSE_ID,
      content: {
        title: CLOSE_COPY.title,
        body: CLOSE_COPY.body,
        data: { target: 'hoy' satisfies NotificationTarget },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    })
  } catch {
    // Nunca romper la app por una notificación.
  }
}
