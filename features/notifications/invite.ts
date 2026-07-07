import type { NotificationWindow } from '@/features/profile/api'

/*
 * La invitación del día siguiente — lógica PURA del scheduler (testeable).
 *
 * Mecánica D (retention-mechanics-spec): el retorno del día 2 no puede
 * depender de la memoria de la usuaria. Una sola notificación local,
 * agendada para MAÑANA dentro de la ventana que ella eligió en onboarding
 * (morning / midday / evening). Framing de invitación, jamás de deuda:
 * nada de rachas, nada de "no pierdas", nada de conteos.
 *
 * El re-armado en cada apertura la auto-capa: mientras la usuaria abre la
 * app a diario, la invitación pendiente se corre siempre a mañana y NUNCA
 * suena; solo alcanza a quien pausó más de un día — y aun entonces suena
 * UNA vez, no una por día perdido (solo existe una agendada a la vez).
 */

/** Hora local de cada ventana. */
export const WINDOW_TIME: Record<
  Exclude<NotificationWindow, 'not_yet'>,
  { hour: number; minute: number }
> = {
  morning: { hour: 9, minute: 0 },
  midday: { hour: 13, minute: 0 },
  evening: { hour: 19, minute: 30 },
}

/** Mañana a la hora de la ventana, en hora local de `now`. */
export function nextInviteDate(now: Date, window: Exclude<NotificationWindow, 'not_yet'>): Date {
  const t = WINDOW_TIME[window]
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, t.hour, t.minute, 0, 0)
  return d
}

/** Copy de la invitación — validado por voice-and-copy: "encenderlo"
 *  refiere a "tu cielo" (el body debe sostenerse solo si el canal trunca
 *  el title), y "basta un registro" invita sin sonar transaccional. */
export const INVITE_COPY = {
  title: 'Tu siguiente estrella',
  body: 'Tu cielo está aquí cuando quieras. Basta un registro para encenderlo.',
} as const

/** La cita del lunes (Fase 7): el sello de la semana pasada la espera en
 *  Órbita. Invitación, jamás deuda ni score. (Pasa por voice-and-copy.) */
export const SEAL_COPY = {
  title: 'Tu semana quedó escrita',
  body: 'Cuando quieras verla, tu cielo la guarda.',
} as const

/**
 * El PRÓXIMO lunes en la ventana elegida, estrictamente futuro: si hoy es
 * lunes no se agenda encima del día en curso (el sello de hoy se vive en
 * la app; la notificación es para la semana que viene). Domingo → mañana.
 */
export function nextSealDate(now: Date, window: Exclude<NotificationWindow, 'not_yet'>): Date {
  const t = WINDOW_TIME[window]
  const weekday = now.getDay() // 0=dom .. 6=sáb; lunes = 1
  let ahead = (8 - weekday) % 7
  if (ahead === 0) ahead = 7
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead, t.hour, t.minute, 0, 0)
}

/*
 * La SEGUNDA invitación de regreso (~7 días) — para quien pausó de verdad.
 * Se agenda junto a la de mañana y se re-arma igual en cada apertura, así
 * que la usuaria activa jamás la oye. Anclada en lo que PERSISTE (nada se
 * apagó), sin conteo de ausencia, sin "te extrañamos". Techo duro del
 * canal: estos dos toques y luego silencio respetuoso — no existe un
 * tercer slot a propósito. (Copy pasa por voice-and-copy.)
 */
export const RETURN_COPY = {
  title: 'Tu cielo sigue contigo',
  body: 'Todo lo que construiste sigue aquí, tal como lo dejaste.',
} as const

/** Siete días después, a la hora de la ventana elegida. */
export function nextReturnDate(now: Date, window: Exclude<NotificationWindow, 'not_yet'>): Date {
  const t = WINDOW_TIME[window]
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, t.hour, t.minute, 0, 0)
}

/*
 * La cita del cierre — la única notificación DIARIA, y solo existe en días
 * con comida registrada: es un veredicto GANADO, nunca un recordatorio de
 * deuda. Sin números en el push (el contenido vive en la card); se agenda
 * al registrar comida y muere sola si el día no la ganó. 20:15: después de
 * que el cierre existe (20:00), antes de que la noche se apague.
 */
export const DAY_CLOSE_TIME = { hour: 20, minute: 15 } as const

export const CLOSE_COPY = {
  title: 'Tu cierre de hoy está listo ✦',
  body: 'Tu día ya tiene su veredicto. Míralo cuando quieras.',
} as const

/*
 * Arbitraje del techo 1/día: el lunes que suena el sello, el cierre cede
 * (lo escaso gana, lo diario cede). El OS no reporta si el sello ya SONÓ,
 * así que la regla es determinística: lunes + sello elegible (hay datos)
 * → sin cierre. Perder un cierre en lunes es más barato que dos toques.
 */
export function sealAbsorbsClose(now: Date, hasData: boolean): boolean {
  return hasData && now.getDay() === 1
}

/** HOY a las 20:15, o null si ya pasó (el cierre tardío se vive en la app;
 *  no se agenda nada para mañana — mañana lo arma su propia comida). */
export function todayCloseDate(now: Date): Date | null {
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    DAY_CLOSE_TIME.hour,
    DAY_CLOSE_TIME.minute,
    0,
    0,
  )
  return d.getTime() > now.getTime() ? d : null
}
