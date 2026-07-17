import { adaptiveTdee, type AdaptiveTdee } from './adaptive-tdee.ts'
import { isDeficitDay } from './deficit.ts'
import type { DailySignals } from './types.ts'

/*
 * Lectura Semanal (V-05) — EL momento donde el motor TE DEVUELVE algo.
 * 100% determinística y PURA: ensambla el gasto real (adaptive-tdee), el
 * ritmo de la semana cerrada (deficit.ts) y UNA palanca retrospectiva.
 * La IA no participa en la detección; si algún día redacta, redacta esto.
 *
 * Grados honestos según datos (nunca lectura fabricada):
 *   · completa — hay gasto real estimado (TDEE) + ritmo de la semana.
 *   · parcial  — hay semana registrada pero aún no TDEE; se dice qué falta.
 *   · null     — menos de MIN_DAYS días con comida esa semana → silencio
 *                (la superficie invita, no inventa).
 *
 * La palanca es FOCO recomendado, nunca receta (frontera del manifiesto):
 * señala dónde vive el espacio, no qué comer ni cuánto.
 */

/** Días con comida mínimos para que la semana tenga lectura. */
export const WEEKLY_READING_MIN_DAYS = 3

export type WeeklyReadingLever = {
  kind: 'finde' | 'entre-semana' | 'proteina'
  text: string
}

export type WeeklyReading = {
  /** Lunes ISO de la semana leída (cerrada). */
  weekStart: string
  /** Domingo ISO de esa semana. */
  weekEnd: string
  grade: 'completa' | 'parcial'
  daysWithFood: number
  deficitDays: number
  /** Promedio de kcal de los días con comida de LA semana. */
  kcalAvg: number | null
  tdee: AdaptiveTdee | null
  /** kg/semana estimados al ritmo actual (negativo = baja). null sin TDEE. */
  paceKgWeek: number | null
  /** La conversación determinística, en beats cortos. */
  opening: string
  body: string[]
  lever: WeeklyReadingLever | null
  closing: string
}

/* ── Fechas (ISO local, sin Date.now: todo entra por parámetro) ──────── */

function isoAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d + n, 12)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

/** Lunes (0) … domingo (6) del día ISO. */
function isoWeekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return (new Date(y, m - 1, d, 12).getDay() + 6) % 7
}

/** El lunes de la última semana CERRADA respecto a hoy (la de la lectura). */
export function lastClosedWeekStart(todayIso: string): string {
  const thisMonday = isoAddDays(todayIso, -isoWeekdayIndex(todayIso))
  return isoAddDays(thisMonday, -7)
}

/* ── La lectura ──────────────────────────────────────────────────────── */

export type WeeklyReadingCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

const fmtPace = (kg: number): string => {
  const abs = Math.abs(kg).toFixed(1)
  return `${kg <= 0 ? '−' : '+'}${abs} kg`
}

export function buildWeeklyReading(
  signals: readonly DailySignals[],
  weekStartIso: string,
  ctx: WeeklyReadingCtx,
): WeeklyReading | null {
  const weekEnd = isoAddDays(weekStartIso, 6)
  const week: (DailySignals | null)[] = Array.from({ length: 7 }, (_, i) => {
    const day = isoAddDays(weekStartIso, i)
    return signals.find((s) => s.day === day) ?? null
  })

  const withFood = week.filter((s) => s != null && s.calories != null && s.calories > 0)
  const daysWithFood = withFood.length
  if (daysWithFood < WEEKLY_READING_MIN_DAYS) return null

  const target = ctx.calorieTarget != null && ctx.calorieTarget > 0 ? ctx.calorieTarget : null
  const deficitDays = target ? withFood.filter((s) => isDeficitDay(s!.calories, target)).length : 0
  const kcalAvg = Math.round(
    withFood.reduce((sum, s) => sum + (s!.calories ?? 0), 0) / daysWithFood,
  )

  // Gasto real: ventana de 28 días cerrados ANTES del día siguiente al
  // domingo leído (la semana leída sí alimenta su propia lectura).
  const tdee = adaptiveTdee([...signals], isoAddDays(weekEnd, 1))
  const paceKgWeek = tdee ? Math.round((((kcalAvg - tdee.tdee) * 7) / 7700) * 20) / 20 : null
  const grade: WeeklyReading['grade'] = tdee ? 'completa' : 'parcial'

  const opening = target
    ? `Tu semana: ${daysWithFood} de 7 días con comida registrada, ${deficitDays} en déficit.`
    : `Tu semana: ${daysWithFood} de 7 días con comida registrada.`

  const body: string[] = []
  if (tdee && paceKgWeek != null) {
    body.push(`Estas semanas tu cuerpo gastó alrededor de ${tdee.tdee} kcal al día.`)
    body.push(`Comiste en promedio ${kcalAvg} kcal en los días que registraste.`)
    body.push(
      tdee.quality === 'solida'
        ? `Ese ritmo apunta a ${fmtPace(paceKgWeek)} por semana. Es un estimado, y sale de tus propios datos.`
        : `Ese ritmo apunta a ${fmtPace(paceKgWeek)} por semana. La lectura aún es temprana; con más días se afina sola.`,
    )
  } else {
    body.push(`Comiste en promedio ${kcalAvg} kcal en los días que registraste.`)
    body.push(
      'Para leer tu gasto real hacen falta más pesajes repartidos en el mes. Con los que registres, esa lectura se abre sola.',
    )
  }

  const lever = buildLever(week, ctx)
  const closing = 'Cada semana deja una huella en tu mes.'

  return {
    weekStart: weekStartIso,
    weekEnd,
    grade,
    daysWithFood,
    deficitDays,
    kcalAvg,
    tdee,
    paceKgWeek,
    opening,
    body,
    lever,
    closing,
  }
}

/* ── La palanca retrospectiva — UNA, con dato, nunca receta ──────────── */

function buildLever(
  week: readonly (DailySignals | null)[],
  ctx: WeeklyReadingCtx,
): WeeklyReadingLever | null {
  const target = ctx.calorieTarget != null && ctx.calorieTarget > 0 ? ctx.calorieTarget : null
  if (target) {
    let weekendOver = 0
    let weekdayOver = 0
    let weekdayNear = 0
    week.forEach((s, i) => {
      if (!s || s.calories == null || s.calories <= 0) return
      const over = s.calories > target
      if (i >= 5) {
        if (over) weekendOver += 1
      } else if (over) weekdayOver += 1
      else weekdayNear += 1
    })
    if (weekendOver >= 1 && weekendOver >= weekdayOver) {
      return {
        kind: 'finde',
        text: 'El finde fue lo más alto en calorías de tu semana. Ahí vive tu espacio para la que empieza.',
      }
    }
    if (weekdayNear >= 3 && weekdayOver === 0) {
      return {
        kind: 'entre-semana',
        text: 'Entre semana sostuviste tu meta calórica. Ese ritmo es tu foco para la semana que empieza.',
      }
    }
  }

  const proteinTarget =
    ctx.proteinTarget != null && ctx.proteinTarget > 0 ? ctx.proteinTarget : null
  if (proteinTarget) {
    const withProtein = week.filter((s) => s != null && s.protein_g != null && s.protein_g > 0)
    if (withProtein.length >= 3) {
      const avg = withProtein.reduce((sum, s) => sum + (s!.protein_g ?? 0), 0) / withProtein.length
      if (avg >= proteinTarget * 0.9) {
        return {
          kind: 'proteina',
          text: 'Tu proteína se mantuvo cerca de su meta toda la semana. Sostenerla es tu foco.',
        }
      }
    }
  }

  return null
}
