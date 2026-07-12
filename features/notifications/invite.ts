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
 *  Órbita. Invitación, jamás deuda ni score. (Pasa por voice-and-copy.)
 *  Política del ✦ (uxui jul 2026): la estrella marca "hay algo GANADO
 *  esperándote" — la llevan N1 cierre, N4 sello y N5 ciclo; invitaciones
 *  (N2/N6) y misterio (N3) van limpios. Emoji: nunca. */
export const SEAL_COPY = {
  title: 'Tu semana quedó escrita ✦',
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
 * N3 · "Stelar encontró algo" — el anuncio del patrón que quedó esperando
 * (detectado, elegible, pero otro tier ganó el slot de la sesión). Regla
 * dura: el push NUNCA adelanta el patrón ni números — el misterio es el
 * gancho y el contenido vive en la ceremonia in-app. Suena mañana en la
 * ventana elegida y se cancela solo si la usuaria lo ve antes.
 * (Pasa por voice-and-copy.)
 */
export const PATTERN_COPY = {
  // Sujeto = tu cielo (no la marca), sin vocabulario de sistema ("tus
  // datos") y SIN repetir el cierre del cierre diario ("Míralo cuando
  // quieras") — el patrón es el momento raro del canal y merece su propia
  // textura. El body se sostiene solo si el canal trunca el title.
  title: 'Tu cielo tiene algo que mostrarte',
  body: 'Hay un patrón nuevo esperándote. Ábrelo cuando quieras.',
} as const

/*
 * N7 · "Stelar encontró una señal" — el anuncio de una señal/patrón que el
 * motor encontró en Órbita (rescate, señal naciente). Hermana de N3 pero para
 * los patrones de Órbita Mes: el tap aterriza en Órbita (target orbit-mes),
 * donde vive la card del hallazgo. Misma regla dura: NUNCA adelanta el patrón
 * ni números — curiosidad + invitación, sin culpa, sin presión. Suena en la
 * ventana elegida y se cancela solo si la usuaria lo ve antes.
 * (Pasa por voice-and-copy.)
 */
export const ORBIT_PATTERN_COPY = {
  // Primera persona (la voz de ELLA, no "Stelar" en tercera → eso sonaba a log de
  // sistema) y hace ECO con la card destino ("Estas semanas encontré algo").
  // Sin "señal" (choca con el nombre propio de la Reliquia "Señal Naciente").
  title: 'Encontré algo en tus semanas',
  body: 'Empezó a tomar forma. Cuando quieras, te lo muestro.',
} as const

/*
 * N5 · el sello del ciclo mensual — anuncio de hito, SOLO post-hoc y solo
 * GANADO: se agenda cuando la figura del mes ya se completó (monotónico:
 * los días con registro solo crecen dentro del mes) y suena el día 1 del
 * mes siguiente en la ventana elegida. Un mes incompleto = silencio total;
 * jamás la versión pre-hoc ("te faltan N días") — eso es countdown.
 * (Pasa por voice-and-copy.)
 */
const CYCLE_MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/** `sealedMonth` = el mes que se sella (el vigente al agendar). El label
 *  del signo llega en MAYÚSCULAS ("LEO") → title-case, como en las
 *  ceremonias de transformación. */
export function cycleCopy(signLabel: string, sealedMonth: Date): { title: string; body: string } {
  const sign = signLabel.charAt(0).toUpperCase() + signLabel.slice(1).toLowerCase()
  const month = CYCLE_MONTHS_ES[sealedMonth.getMonth()]
  return {
    // "quedó entero", no "quedó completo": "completo" es la palabra vetada
    // de las ceremonias (suena a tarea-checkeada) y "quedó X" ecoa el
    // patrón del sello semanal ("Tu semana quedó escrita").
    // El MES vive en el body, no en el title: "Tu Capricornio de
    // septiembre quedó entero" (41 chars) se truncaba en el banner
    // compacto justo en "entero", que es todo el veredicto. Peor caso del
    // title ahora: "Tu Capricornio quedó entero ✦" = 29 ✓.
    title: `Tu ${sign} quedó entero ✦`,
    body: `Sostuviste ${month} entero. Tu cielo lo guarda para siempre.`,
  }
}

/** El día 1 del mes SIGUIENTE, en la ventana elegida (el sello se anuncia
 *  la mañana después de que el ciclo terminó, nunca antes). */
export function nextCycleDate(now: Date, window: Exclude<NotificationWindow, 'not_yet'>): Date {
  const t = WINDOW_TIME[window]
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, t.hour, t.minute, 0, 0)
}

/** ¿Caen el mismo día calendario local? (arbitraje patrón vs sello). */
export function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

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
