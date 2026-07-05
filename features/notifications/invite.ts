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
