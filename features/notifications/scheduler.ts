import Constants from 'expo-constants'
import { Platform } from 'react-native'

import type { NotificationWindow } from '@/features/profile/api'
import { track } from '@/lib/analytics'

import {
  CLOSE_COPY,
  INVITE_COPY,
  nextInviteDate,
  nextReturnDate,
  nextSealDate,
  PATTERN_COPY,
  RETURN_COPY,
  sameLocalDay,
  SEAL_COPY,
  sealAbsorbsClose,
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

/** Telemetría del canal: sin "delivered" en notificaciones locales, el
 *  proxy de análisis es notif_scheduled (aquí) vs notif_opened (response
 *  router). `for` lleva la fecha agendada para poder cruzar con aperturas
 *  orgánicas cercanas al horario. */
function trackScheduled(id: string, target: NotificationTarget, date: Date): void {
  track('notif_scheduled', { id, target, for: date.toISOString() })
}

/** El slot N3 · "Stelar encontró algo" — idempotente como los demás. */
export const PATTERN_ID = 'stelar-pattern-found'

/** La fecha de disparo del push de patrón (si hay uno agendado): viaja en
 *  `data.fireAt` porque el trigger nativo no se puede leer de forma
 *  portable. Alimenta el arbitraje patrón > sello. */
async function scheduledPatternFireAt(
  Notifications: typeof import('expo-notifications'),
): Promise<Date | null> {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => [])
  const pattern = all.find((r) => r.identifier === PATTERN_ID)
  const fireAt = (pattern?.content.data as { fireAt?: unknown } | null)?.fireAt
  return typeof fireAt === 'string' ? new Date(fireAt) : null
}

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

    // Arbitraje patrón > invitación: ambos suenan mañana en la ventana. Si
    // hay un patrón esperando, ese push ya hace el trabajo de la invitación
    // (y con mejor contenido) — la invitación cede este re-armado.
    const patternPending = (await scheduledPatternFireAt(Notifications)) != null
    if (!patternPending) {
      const inviteDate = nextInviteDate(new Date(), window)
      await Notifications.scheduleNotificationAsync({
        identifier: INVITE_ID,
        content: {
          title: INVITE_COPY.title,
          body: INVITE_COPY.body,
          data: { target: 'hoy' satisfies NotificationTarget },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: inviteDate,
        },
      })
      trackScheduled(INVITE_ID, 'hoy', inviteDate)
    }

    // La red de 7 días: se re-arma junto con la de mañana, así que solo
    // alcanza a quien de verdad pausó una semana. Después de esta, nada.
    const returnDate = nextReturnDate(new Date(), window)
    await Notifications.scheduleNotificationAsync({
      identifier: RETURN_ID,
      content: {
        title: RETURN_COPY.title,
        body: RETURN_COPY.body,
        data: { target: 'hoy' satisfies NotificationTarget },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: returnDate,
      },
    })
    trackScheduled(RETURN_ID, 'hoy', returnDate)
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

    const sealDate = nextSealDate(new Date(), window)

    // Arbitraje patrón > sello: si el push de patrón cae ese mismo lunes
    // (misma ventana, mismo minuto), el sello cede este re-armado — se
    // volverá a armar en la siguiente apertura para el lunes que sigue.
    const patternFireAt = await scheduledPatternFireAt(Notifications)
    if (patternFireAt && sameLocalDay(patternFireAt, sealDate)) return

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
        date: sealDate,
      },
    })
    trackScheduled(SEAL_ID, 'orbit-semana', sealDate)
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
 *
 * Techo 1/día: el lunes que el sello es elegible (`hasAnyData`), el cierre
 * cede — ver sealAbsorbsClose en invite.ts. El cancel corre ANTES del
 * arbitraje para que un cierre ya agendado ese lunes también se retire.
 */
export async function syncDayCloseInvite(
  window: NotificationWindow | null | undefined,
  hasMealToday: boolean,
  hasAnyData: boolean,
): Promise<void> {
  if (isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')

    await Notifications.cancelScheduledNotificationAsync(DAY_CLOSE_ID).catch(() => {})
    if (window == null || window === 'not_yet' || !hasMealToday) return
    if (sealAbsorbsClose(new Date(), hasAnyData)) return

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
    trackScheduled(DAY_CLOSE_ID, 'hoy', date)
  } catch {
    // Nunca romper la app por una notificación.
  }
}

/**
 * N3 · "Stelar encontró algo": anuncia el patrón que quedó ESPERANDO (la
 * detección lo encontró elegible pero Regreso/Transformación ganó el slot
 * de la sesión — ver patternWaiting en features/revelations/logic.ts).
 * Suena MAÑANA en la ventana elegida; sin adelantar contenido ni números.
 *
 * `waiting=false` cancela (idempotente): cuando la ceremonia por fin se
 * muestra, la re-detección devuelve waiting=false y el push muere solo.
 * Hereda el rate-limit de patrones (1/7d) del propio motor de detección.
 *
 * Arbitraje 1/día: absorbe la invitación de mañana (mismo minuto, mejor
 * contenido) y, si mañana es lunes, desplaza al sello (patrón > sello).
 */
export async function syncPatternInvite(
  window: NotificationWindow | null | undefined,
  waiting: boolean,
): Promise<void> {
  if (isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')

    await Notifications.cancelScheduledNotificationAsync(PATTERN_ID).catch(() => {})
    if (window == null || window === 'not_yet' || !waiting) return

    const perm = await Notifications.getPermissionsAsync()
    if (perm.status !== 'granted') return

    const date = nextInviteDate(new Date(), window)
    // patrón > invitación: mismo minuto de mañana — la invitación cede.
    await Notifications.cancelScheduledNotificationAsync(INVITE_ID).catch(() => {})
    // patrón > sello: si mañana es lunes, el sello cede (se re-arma en la
    // próxima apertura para el lunes siguiente).
    if (date.getDay() === 1) {
      await Notifications.cancelScheduledNotificationAsync(SEAL_ID).catch(() => {})
    }

    await Notifications.scheduleNotificationAsync({
      identifier: PATTERN_ID,
      content: {
        title: PATTERN_COPY.title,
        body: PATTERN_COPY.body,
        // La ceremonia del patrón vive en Hoy (el orquestador dispara al
        // abrir) → el tap aterriza ahí, donde la promesa se cumple.
        // fireAt: el trigger nativo no se puede leer de forma portable;
        // el arbitraje patrón > sello lo lee de aquí.
        data: { target: 'hoy' satisfies NotificationTarget, fireAt: date.toISOString() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
      },
    })
    trackScheduled(PATTERN_ID, 'hoy', date)
  } catch {
    // Nunca romper la app por una notificación.
  }
}
