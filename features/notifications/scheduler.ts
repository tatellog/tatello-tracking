import Constants from 'expo-constants'
import { Platform } from 'react-native'

import type { NotificationWindow } from '@/features/profile/api'
import { track } from '@/lib/analytics'

import {
  CLOSE_COPY,
  cycleCopy,
  INVITE_COPY,
  nextCycleDate,
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
export type NotificationTarget = 'hoy' | 'orbit-semana' | 'orbit-mes'

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

/*
 * Canales de Android (uxui jul 2026) — la ÚNICA forma en Android de darle
 * a la usuaria control granular sin que apague todo:
 *   · announcements (DEFAULT, suena): los ganados — cierre, patrón, sello,
 *     ciclo. Acompañan, no interrumpen (nunca heads-up).
 *   · invitations (LOW, silencioso): N2/N6 — la invitación espera en la
 *     bandeja, no llama. Sonarle a quien pausó roza la presión prohibida.
 * OJO: la importance de un canal creado no se puede cambiar sin reinstalar;
 * decidido ANTES del primer build de beta a propósito. En iOS el espejo es
 * interruptionLevel 'passive' en las invitaciones.
 */
export const CHANNEL_ANNOUNCEMENTS = 'announcements'
export const CHANNEL_INVITATIONS = 'invitations'

/** Idempotente y llamado por CADA sync antes de agendar: el canal viejo
 *  'default' se creaba solo en syncNextStarInvite y otro sync podía
 *  agendar antes de que existiera. */
export async function ensureChannels(
  Notifications: typeof import('expo-notifications'),
): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ANNOUNCEMENTS, {
    name: 'Tus anuncios',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {})
  await Notifications.setNotificationChannelAsync(CHANNEL_INVITATIONS, {
    name: 'Invitaciones de regreso',
    importance: Notifications.AndroidImportance.LOW,
  }).catch(() => {})
}

/** Telemetría del canal: sin "delivered" en notificaciones locales, el
 *  proxy de análisis es notif_scheduled (aquí) vs notif_opened (response
 *  router). `for` lleva la fecha agendada para poder cruzar con aperturas
 *  orgánicas cercanas al horario. */
function trackScheduled(id: string, target: NotificationTarget, date: Date): void {
  track('notif_scheduled', { id, target, for: date.toISOString() })
}

/** El slot N3 · "Stelar encontró algo" — idempotente como los demás. */
export const PATTERN_ID = 'stelar-pattern-found'
/** El slot N5 · el sello del ciclo mensual — idempotente como los demás. */
export const CYCLE_ID = 'stelar-cycle-seal'

/** La fecha de disparo de un slot agendado (si existe): viaja en
 *  `data.fireAt` porque el trigger nativo no se puede leer de forma
 *  portable. Alimenta los arbitrajes ciclo > patrón > sello > cierre. */
async function scheduledFireAt(
  Notifications: typeof import('expo-notifications'),
  id: string,
): Promise<Date | null> {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => [])
  const req = all.find((r) => r.identifier === id)
  const fireAt = (req?.content.data as { fireAt?: unknown } | null)?.fireAt
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

    await ensureChannels(Notifications)

    // Arbitraje ciclo/patrón > invitación: si un anuncio mayor ya suena
    // mañana en la ventana (patrón siempre cae ahí; el ciclo solo cuando
    // hoy es fin de mes), ese push hace el trabajo de la invitación con
    // mejor contenido — la invitación cede este re-armado.
    const inviteDate = nextInviteDate(new Date(), window)
    const patternPending = (await scheduledFireAt(Notifications, PATTERN_ID)) != null
    const cycleFireAt = await scheduledFireAt(Notifications, CYCLE_ID)
    const cycleTomorrow = cycleFireAt != null && sameLocalDay(cycleFireAt, inviteDate)
    if (!patternPending && !cycleTomorrow) {
      await Notifications.scheduleNotificationAsync({
        identifier: INVITE_ID,
        content: {
          title: INVITE_COPY.title,
          body: INVITE_COPY.body,
          data: { target: 'hoy' satisfies NotificationTarget },
          // "Tu cielo está aquí cuando quieras", literal: la invitación
          // espera en la bandeja sin encender pantalla ni sonar (iOS).
          interruptionLevel: 'passive',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: inviteDate,
          channelId: CHANNEL_INVITATIONS,
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
        interruptionLevel: 'passive',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: returnDate,
        channelId: CHANNEL_INVITATIONS,
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

    await ensureChannels(Notifications)

    const sealDate = nextSealDate(new Date(), window)

    // Arbitraje ciclo/patrón > sello: si un anuncio mayor cae ese mismo
    // lunes (misma ventana, mismo minuto), el sello cede este re-armado —
    // se volverá a armar en la siguiente apertura para el lunes que sigue.
    const patternFireAt = await scheduledFireAt(Notifications, PATTERN_ID)
    if (patternFireAt && sameLocalDay(patternFireAt, sealDate)) return
    const cycleFireAt = await scheduledFireAt(Notifications, CYCLE_ID)
    if (cycleFireAt && sameLocalDay(cycleFireAt, sealDate)) return

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
        channelId: CHANNEL_ANNOUNCEMENTS,
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

    // Arbitraje ciclo/patrón > cierre: si un anuncio mayor aún no disparado
    // suena HOY (las ventanas van antes de las 20:15), el cierre cede.
    const cycleFireAt = await scheduledFireAt(Notifications, CYCLE_ID)
    if (cycleFireAt && sameLocalDay(cycleFireAt, date)) return
    const patternFireAt = await scheduledFireAt(Notifications, PATTERN_ID)
    if (patternFireAt && sameLocalDay(patternFireAt, date)) return

    const perm = await Notifications.getPermissionsAsync()
    if (perm.status !== 'granted') return

    await ensureChannels(Notifications)

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
        channelId: CHANNEL_ANNOUNCEMENTS,
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

    await ensureChannels(Notifications)

    const date = nextInviteDate(new Date(), window)
    // ciclo > patrón: si el sello del ciclo ya suena ese mismo día, el
    // patrón cede este re-armado (volverá a armarse en la próxima apertura
    // mientras siga esperando).
    const cycleFireAt = await scheduledFireAt(Notifications, CYCLE_ID)
    if (cycleFireAt && sameLocalDay(cycleFireAt, date)) return
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
        channelId: CHANNEL_ANNOUNCEMENTS,
      },
    })
    trackScheduled(PATTERN_ID, 'hoy', date)
  } catch {
    // Nunca romper la app por una notificación.
  }
}

/**
 * N5 · el sello del ciclo mensual: cuando la figura del mes se completa
 * (monotónico dentro del mes), se agenda el anuncio para el día 1 del mes
 * siguiente en la ventana elegida. SOLO post-hoc y solo ganado — un mes
 * incompleto es silencio, jamás "quedó a medias" ni "te faltan N días".
 *
 * El día 1 el slot no se toca aunque `figureComplete` llegue en false (el
 * mes nuevo ya reinició la figura): el anuncio de algo ganado se sostiene
 * incluso si la usuaria abre la app antes de su ventana.
 *
 * Arbitraje 1/día (lo más escaso gana): si cae mañana (hoy es fin de mes)
 * absorbe invitación y patrón; si cae lunes, desplaza al sello semanal.
 */
export async function syncCycleSealInvite(
  window: NotificationWindow | null | undefined,
  figureComplete: boolean,
  signLabel: string,
): Promise<void> {
  if (isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')

    if (window == null || window === 'not_yet') {
      await Notifications.cancelScheduledNotificationAsync(CYCLE_ID).catch(() => {})
      return
    }

    // Suena HOY → no tocar (ver nota de arriba).
    const existing = await scheduledFireAt(Notifications, CYCLE_ID)
    if (existing && sameLocalDay(existing, new Date())) return

    await Notifications.cancelScheduledNotificationAsync(CYCLE_ID).catch(() => {})
    if (!figureComplete || !signLabel) return

    const perm = await Notifications.getPermissionsAsync()
    if (perm.status !== 'granted') return

    await ensureChannels(Notifications)

    const date = nextCycleDate(new Date(), window)
    // ciclo > patrón/invitación: si el sello cae mañana (hoy es fin de
    // mes), absorbe a los dos (mismo minuto, contenido mayor).
    if (sameLocalDay(date, nextInviteDate(new Date(), window))) {
      await Notifications.cancelScheduledNotificationAsync(INVITE_ID).catch(() => {})
      await Notifications.cancelScheduledNotificationAsync(PATTERN_ID).catch(() => {})
    }
    // ciclo > sello semanal: si el día 1 es lunes, el sello cede (se
    // re-arma en la próxima apertura para el lunes siguiente).
    if (date.getDay() === 1) {
      await Notifications.cancelScheduledNotificationAsync(SEAL_ID).catch(() => {})
    }

    const copy = cycleCopy(signLabel, new Date())
    await Notifications.scheduleNotificationAsync({
      identifier: CYCLE_ID,
      content: {
        title: copy.title,
        body: copy.body,
        // El copy promete el ciclo guardado → el tap aterriza en Órbita
        // Mes. fireAt alimenta los arbitrajes (el trigger nativo no se
        // puede leer de forma portable).
        data: { target: 'orbit-mes' satisfies NotificationTarget, fireAt: date.toISOString() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ANNOUNCEMENTS,
      },
    })
    trackScheduled(CYCLE_ID, 'orbit-mes', date)
  } catch {
    // Nunca romper la app por una notificación.
  }
}
