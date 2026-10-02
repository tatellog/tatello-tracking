/*
 * Tu smartwatch · lo que el reloj dice de TU ejercicio, comparado contigo
 * (dueña 30 sep 2026: "más información de mi ejercicio, que Stelar sea el
 * source of truth de mi peso, solo lo relevante"). Lógica PURA.
 *
 * Todo se compara contra la propia usuaria (su promedio, su semana, sus 90
 * días), nunca contra una meta externa. Sin rachas: la semana es continuidad,
 * los días de pausa no son huecos. Las kcal del reloj solo viajan como dato de
 * procedencia; nada de aquí las convierte en comida ganada.
 */
import type { DailySignals } from '@/features/orbit/api'
import { isDeficitDay } from '@/features/orbit/deficit'
import { dayQuality } from '@/features/orbit/day-quality'

import type { HealthWorkout } from './api'
import { localDayOf } from './health-summary'
import { addDaysIso } from './sleep-detail'

export const WORKOUT_NAME: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  caminata: 'Caminata',
}
const WORKOUT_NOUN: Record<string, string> = {
  fuerza: 'de fuerza',
  cardio: 'de cardio',
  caminata: 'de caminata',
}
const INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type Session = {
  day: string
  type: string
  minutes: number
  kcal: number
  startedAt: string
  endedAt: string
  activity: string | null
}

/** Segunda red contra duplicados (la primera es el sync, que borra lo que
 *  Salud ya no tiene): el mismo inicio + tipo + duración = el mismo entreno.
 *  Garmin reescribe cada entreno con un ID nuevo y una base vieja podía tener
 *  varias copias; aquí cuentan UNA vez. */
function uniqueWorkouts(workouts: readonly HealthWorkout[]): HealthWorkout[] {
  const seen = new Set<string>()
  return workouts.filter((w) => {
    const key = `${w.started_at.slice(0, 16)}|${w.workout_type ?? ''}|${w.duration_min ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sessions(workouts: readonly HealthWorkout[], tz: string): Session[] {
  return uniqueWorkouts(workouts).map((w) => ({
    day: localDayOf(w.started_at, tz),
    type: w.workout_type ?? 'otro',
    minutes: Math.max(0, w.duration_min ?? 0),
    kcal: Math.max(0, w.energy_kcal ?? 0),
    startedAt: w.started_at,
    endedAt: w.ended_at,
    activity: w.activity,
  }))
}

function weekdayMon(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7
}

/* ── El entreno de hoy ─────────────────────────────────────────────── */

export type TodayWorkout = {
  /** Tipo principal (el de la sesión más larga). */
  type: string
  name: string
  totalMinutes: number
  kcal: number
  /** Inicio y fin de la sesión principal (ISO). */
  startedAt: string
  endedAt: string
  sessions: number
  /** Tu promedio de ese tipo (min), sin hoy; null con menos de 3 sesiones. */
  average: number | null
  /** "Tu sesión de fuerza más larga en 6 semanas" (null si no es marca). */
  record: string | null
  /** Cada sesión del día, en orden: qué hiciste, a qué hora, cuánto. */
  list: SessionLine[]
}

/** Una sesión para la lista del día ("Bici · 12:18 pm · 12 min · ~73 kcal"). */
export type SessionLine = {
  key: string
  /** "Bici", "Fuerza"…: la actividad real; si no se sabe, el tipo canónico. */
  name: string
  type: string
  startedAt: string
  endedAt: string
  minutes: number
  kcal: number
}

export function todayWorkout(
  workouts: readonly HealthWorkout[],
  today: string,
  tz: string,
): TodayWorkout | null {
  const all = sessions(workouts, tz)
  const mine = all.filter((s) => s.day === today)
  if (mine.length === 0) return null
  const main = mine.reduce((a, b) => (b.minutes > a.minutes ? b : a))
  const totalMinutes = mine.reduce((a, s) => a + s.minutes, 0)
  const prior = all.filter((s) => s.day < today && s.type === main.type && s.minutes > 0)
  const average =
    prior.length >= 3 ? Math.round(prior.reduce((a, s) => a + s.minutes, 0) / prior.length) : null
  return {
    type: main.type,
    name: WORKOUT_NAME[main.type] ?? 'Entreno',
    totalMinutes,
    kcal: Math.round(mine.reduce((a, s) => a + s.kcal, 0)),
    startedAt: main.startedAt,
    endedAt: main.endedAt,
    sessions: mine.length,
    list: [...mine]
      .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
      .map((x) => ({
        key: x.startedAt,
        name: x.activity ?? WORKOUT_NAME[x.type] ?? 'Entreno',
        type: x.type,
        startedAt: x.startedAt,
        endedAt: x.endedAt,
        minutes: x.minutes,
        kcal: Math.round(x.kcal),
      })),
    average,
    record: sessionRecord(prior, main, today),
  }
}

/** Marca personal: la sesión de hoy supera a todas las de ese tipo de las
 *  últimas N semanas (mín. 3 semanas y 3 sesiones previas). Solo celebra. */
function sessionRecord(prior: Session[], main: Session, today: string): string | null {
  if (prior.length < 3 || main.minutes <= 0) return null
  const longer = prior
    .filter((s) => s.minutes >= main.minutes)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
  const noun = WORKOUT_NOUN[main.type] ?? ''
  const first = prior.reduce((a, s) => (s.day < a ? s.day : a), today)
  if (longer.length === 0) {
    const weeks = Math.floor(daysBetween(first, today) / 7)
    return weeks >= 3
      ? `Tu sesión ${noun} más larga desde que usas tu reloj`.replace('  ', ' ')
      : null
  }
  const weeks = Math.floor(daysBetween(longer[0]!.day, today) / 7)
  return weeks >= 3 ? `Tu sesión ${noun} más larga en ${weeks} semanas`.replace('  ', ' ') : null
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000,
  )
}

/* ── Tu semana de movimiento ───────────────────────────────────────── */

export type WeekDay = {
  day: string
  initial: string
  minutes: number
  /** Tipo principal del día (null sin entreno). */
  type: string | null
  isToday: boolean
  isFuture: boolean
}

export type MovementWeek = {
  days: WeekDay[]
  sessions: number
  strength: number
  totalMinutes: number
  /** "2 a 3 por semana" en tus 4 semanas anteriores (null sin historia). */
  rhythm: string | null
}

export function movementWeek(
  workouts: readonly HealthWorkout[],
  today: string,
  tz: string,
): MovementWeek {
  const all = sessions(workouts, tz)
  const monday = addDaysIso(today, -weekdayMon(today))
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysIso(monday, i)
    const mine = all.filter((s) => s.day === day)
    const main = mine.length ? mine.reduce((a, b) => (b.minutes > a.minutes ? b : a)) : null
    return {
      day,
      initial: INITIALS[i]!,
      minutes: mine.reduce((a, s) => a + s.minutes, 0),
      type: main?.type ?? null,
      isToday: day === today,
      isFuture: day > today,
    }
  })
  const thisWeek = all.filter((s) => s.day >= monday && s.day <= today)
  // Ritmo: sesiones por semana en las 4 semanas completas anteriores.
  const counts: number[] = []
  for (let w = 1; w <= 4; w++) {
    const from = addDaysIso(monday, -7 * w)
    const to = addDaysIso(from, 6)
    counts.push(all.filter((s) => s.day >= from && s.day <= to).length)
  }
  const active = counts.filter((c) => c > 0).length
  const lo = Math.min(...counts)
  const hi = Math.max(...counts)
  const rhythm = active >= 2 ? (lo === hi ? `${hi} por semana` : `${lo} a ${hi} por semana`) : null
  return {
    days,
    sessions: thisWeek.length,
    strength: thisWeek.filter((s) => s.type === 'fuerza').length,
    totalMinutes: thisWeek.reduce((a, s) => a + s.minutes, 0),
    rhythm,
  }
}

/** "2 h 40" / "45 min". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

/* ── El puente con tu peso ─────────────────────────────────────────── */

/** ¿Los días que entrenas (o entrenas fuerza) cierras en déficit más seguido?
 *  Sale de TUS días completos con meta; necesita ≥ 4 días por lado y una
 *  diferencia clara. Null si no hay evidencia: nunca se rellena. */
export function trainingDeficitBridge(
  signals: readonly DailySignals[],
  calorieTarget: number | null,
  focusType: string | null,
): string | null {
  if (calorieTarget == null || calorieTarget <= 0) return null
  const days = signals.filter((s) => s.day && dayQuality(s) === 'completo')
  const rate = (xs: readonly DailySignals[]) =>
    xs.filter((s) => isDeficitDay(s.calories, calorieTarget)).length / xs.length
  const tryBridge = (isIt: (s: DailySignals) => boolean, phrase: string): string | null => {
    const yes = days.filter(isIt)
    const no = days.filter((s) => !s.trained)
    if (yes.length < 4 || no.length < 4) return null
    return rate(yes) - rate(no) >= 0.12 ? phrase : null
  }
  if (focusType === 'fuerza') {
    const strength = tryBridge(
      (s) => s.trained === true && s.workout_type === 'fuerza',
      'Tus días con fuerza cierras en déficit más seguido.',
    )
    if (strength) return strength
  }
  return tryBridge(
    (s) => s.trained === true,
    'Los días que entrenas cierras en déficit más seguido.',
  )
}

/** El entreno de CUALQUIER día (el detalle de un día pasado en Descubre):
 *  mismo cálculo, con tu promedio y tu marca hasta esa fecha, para que el
 *  pasado no cambie con lo que entrenes después. */
export const workoutOfDay = todayWorkout
