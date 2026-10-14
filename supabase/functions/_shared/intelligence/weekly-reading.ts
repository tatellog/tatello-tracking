import { adaptiveTdee, type AdaptiveTdee } from './adaptive-tdee.ts'
import { countsForProteinAverage, dayQuality } from './day-quality.ts'
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
  /** kg/semana estimados al ritmo actual (negativo = baja). Solo con TDEE de
   *  calidad sólida y con el promedio de días completos (ST-010 · P-06);
   *  null si no. */
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

/** Días de `a` a `b` (b − a), en ISO local. */
function isoDayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number]
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number]
  return Math.round(
    (new Date(by, bm - 1, bd, 12).getTime() - new Date(ay, am - 1, ad, 12).getTime()) / 86400000,
  )
}

/** El lunes de la última semana CERRADA respecto a hoy (la de la lectura). */
export function lastClosedWeekStart(todayIso: string): string {
  const thisMonday = isoAddDays(todayIso, -isoWeekdayIndex(todayIso))
  return isoAddDays(thisMonday, -7)
}

/** ¿Esa semana tendrá lectura? La MISMA condición con la que
 *  buildWeeklyReading calla o habla (días con comida ≥ MIN), sin generarla:
 *  Hoy y Descubre la usan para avisar sin congelar nada (ST-010 · H8). */
export function weekHasReading(signals: readonly DailySignals[], weekStartIso: string): boolean {
  const weekEnd = isoAddDays(weekStartIso, 6)
  let withFood = 0
  for (const s of signals) {
    if (s.day == null || s.day < weekStartIso || s.day > weekEnd) continue
    if (dayQuality(s) !== 'vacio') withFood += 1
  }
  return withFood >= WEEKLY_READING_MIN_DAYS
}

/* ── La lectura ──────────────────────────────────────────────────────── */

export type WeeklyReadingCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

const fmtPace = (kg: number): string => {
  const abs = Math.abs(kg).toFixed(1)
  return `${kg < 0 ? '−' : '+'}${abs} kg`
}

const avgKcal = (rows: readonly (DailySignals | null)[]): number =>
  Math.round(rows.reduce((sum, s) => sum + (s?.calories ?? 0), 0) / rows.length)

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

  // "Día con comida" = no-vacío (la definición única de day-quality.ts):
  // los parciales cuentan aquí a propósito — la lectura semanal habla de
  // presencia y ritmo, no exige días completos (V-09, sin exigencia).
  const withFood = week.filter((s) => s != null && dayQuality(s) !== 'vacio')
  const daysWithFood = withFood.length
  if (daysWithFood < WEEKLY_READING_MIN_DAYS) return null

  const target = ctx.calorieTarget != null && ctx.calorieTarget > 0 ? ctx.calorieTarget : null
  const deficitDays = target ? withFood.filter((s) => isDeficitDay(s!.calories, target)).length : 0
  const kcalAvg = avgKcal(withFood)

  // Gasto real: ventana de 28 días cerrados ANTES del día siguiente al
  // domingo leído (la semana leída sí alimenta su propia lectura).
  const tdee = adaptiveTdee([...signals], isoAddDays(weekEnd, 1))
  const grade: WeeklyReading['grade'] = tdee ? 'completa' : 'parcial'
  // El ritmo en kg solo con gasto SÓLIDO y con días completos (ST-010 · P-06):
  // comparar un promedio con parciales contra un gasto sin ellos sesgaba
  // hacia "bajas más rápido". Así la cuenta que se ve es la que da el ritmo.
  const complete = week.filter((s) => s != null && dayQuality(s) === 'completo')
  const completeAvg = complete.length > 0 ? avgKcal(complete) : null
  const paceKgWeek =
    tdee && tdee.quality === 'solida' && completeAvg != null
      ? Math.round((((completeAvg - tdee.tdee) * 7) / 7700) * 20) / 20
      : null

  // "N de M días" desde que empezaste (ST-010 · H4): la primera semana no
  // cuenta los días antes de tu primer dato. Nunca "0 en déficit" (H11).
  let firstDay: string | null = null
  for (const s of signals) if (s.day && (firstDay == null || s.day < firstDay)) firstDay = s.day
  const daysOpen =
    firstDay != null && firstDay > weekStartIso
      ? Math.max(daysWithFood, 7 - isoDayDiff(weekStartIso, firstDay))
      : 7
  const opening =
    target && deficitDays > 0
      ? `Tu semana: ${daysWithFood} de ${daysOpen} días con comida registrada, ${deficitDays} de ellos en déficit.`
      : `Tu semana: ${daysWithFood} de ${daysOpen} días con comida registrada.`

  const body: string[] = []
  if (tdee && paceKgWeek != null && completeAvg != null) {
    body.push(`Últimamente tu cuerpo ha gastado alrededor de ${tdee.tdee} kcal al día.`)
    body.push(`En tus días completos comiste en promedio ${completeAvg} kcal.`)
    body.push(
      Math.abs(paceKgWeek) < 0.05
        ? 'Ese ritmo apunta a sostener tu peso. Es un estimado que sale de tus propios datos.'
        : `Ese ritmo apunta a ${fmtPace(paceKgWeek)} por semana. Es un estimado que sale de tus propios datos.`,
    )
  } else if (tdee) {
    body.push(`Últimamente tu cuerpo ha gastado alrededor de ${tdee.tdee} kcal al día.`)
    body.push(`Comiste en promedio ${kcalAvg} kcal en los días que registraste.`)
    body.push('Todavía es pronto para leer el ritmo de tu peso. Con más días aparece.')
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
    // Entre semana "sostuviste tu meta" = días en la banda SANA (ST-010 · H1):
    // un día de 500 kcal con meta de 1800 no es meta sostenida.
    let weekdayInBand = 0
    const weekendKcal: number[] = []
    const weekdayKcal: number[] = []
    week.forEach((s, i) => {
      if (!s || s.calories == null || s.calories <= 0) return
      const over = s.calories > target
      if (i >= 5) {
        weekendKcal.push(s.calories)
        if (over) weekendOver += 1
      } else {
        weekdayKcal.push(s.calories)
        if (over) weekdayOver += 1
        else if (isDeficitDay(s.calories, target)) weekdayInBand += 1
      }
    })
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    // "Lo más alto en calorías" tiene que ser cierto (H7): el finde pasó la
    // meta Y su promedio fue mayor que el de entre semana.
    const weekendHighest =
      weekendOver >= 1 &&
      weekendKcal.length > 0 &&
      weekdayKcal.length > 0 &&
      mean(weekendKcal) > mean(weekdayKcal)
    if (weekendHighest) {
      return {
        kind: 'finde',
        text: 'El fin de semana fue lo más alto en calorías. Ahí tienes espacio para la semana que empieza.',
      }
    }
    if (weekdayInBand >= 3 && weekdayOver === 0) {
      return {
        kind: 'entre-semana',
        text: 'Entre semana sostuviste tu meta calórica. Ese ritmo es tu foco para la semana que empieza.',
      }
    }
  }

  const proteinTarget =
    ctx.proteinTarget != null && ctx.proteinTarget > 0 ? ctx.proteinTarget : null
  if (proteinTarget) {
    // Solo días completos (decisión dueña 14 oct 2026, countsForProteinAverage).
    const withProtein = week.filter(
      (s): s is DailySignals => s != null && countsForProteinAverage(s),
    )
    if (withProtein.length >= 3) {
      const avg = withProtein.reduce((sum, s) => sum + (s!.protein_g ?? 0), 0) / withProtein.length
      if (avg >= proteinTarget * 0.9) {
        return {
          kind: 'proteina',
          text: 'En tus días completos, tu proteína se mantuvo cerca de su meta. Sostenerla es tu foco.',
        }
      }
    }
  }

  return null
}
