/*
 * "Hoy en vivo" — today's live readings for the Día segment, as CARDS.
 * Each card (Comida / Agua / Cuerpo / Bienestar) separates the honest
 * NUMBER (a data row: name · bar · figure) from the coach's VOICE (one
 * Cormorant line at the foot). So the truth can be exact and the voice
 * can be warm, without one diluting the other. Deterministic, no AI.
 *
 * Manifiesto guardrails:
 *   • Protein is the cared metric → shown with grams + a win when reached.
 *   • Calories are the truth the owner asked for: shown honestly, but as
 *     a FACT in leche (never red): over target reads "+340 sobre tu
 *     objetivo" in gold, with a warm question, never "te pasaste".
 *   • Sleep is NOT a goal → a plain figure, no progress bar.
 *   • Rest is valid; no number screams; no countdown.
 */
import type { DailySignals } from './types'

export type DayTone = 'win' | 'context' | 'over' | 'soft'
export type DayMetricDisplay = 'bar' | 'plain' | 'dots' | 'chip'

export type DayMetric = {
  key: string
  label: string
  /** The figure, pre-formatted: "98 / 120 g", "+340", "7.2 h". */
  value: string
  /** Small caption under the figure: "de 2000 kcal", "sobre tu objetivo". */
  sub?: string
  /** Progress fill 0..1 (bar display only). */
  fill?: number
  /** Overflow beyond target 0..1 → the gold segment (over only). */
  over?: number
  /** Filled count for the dots display (energy: out of 5). */
  dots?: number
  display: DayMetricDisplay
  tone: DayTone
}

/** Visual hierarchy — the deficit (Comida) is the luminous body; the rest
 *  is the field of stars around it. Drives chrome, not data. */
export type DayCardWeight = 'hero' | 'mid' | 'soft'

export type DayCard = {
  key: string
  label: string
  weight: DayCardWeight
  /** A prominent verdict under the label — used by Comida for the deficit
   *  status ("En déficit" / "Fuera del déficit"), the core weight signal. */
  status?: { text: string; tone: DayTone }
  metrics: DayMetric[]
  /** One coach line at the card's foot. */
  coach: string | null
}

export type DayReadingContext = {
  calorieTarget: number | null
  proteinTarget: number | null
  /** Daily water goal in 250 ml glasses (from useWaterGoal). */
  waterGoalGlasses: number
  /** Regla de negocio (cycle-gate.ts): false → nunca mostrar el chip de
   *  ciclo, aunque queden cycle_events viejos en la data (p. ej. la
   *  usuaria cambió su situación a "no tengo ciclo" después de haber
   *  marcado periodos). */
  cycleEnabled?: boolean
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/* ── Comida — protein (cared) + the honest deficit number ─────────── */
function comida(s: DailySignals, ctx: DayReadingContext): DayCard | null {
  const hasFood = s.meal_count != null || s.calories != null || s.protein_g != null
  if (!hasFood) return null
  const metrics: DayMetric[] = []

  let proteinReached = false
  if (ctx.proteinTarget && ctx.proteinTarget > 0) {
    const p = Math.round(s.protein_g ?? 0)
    proteinReached = p >= ctx.proteinTarget
    metrics.push({
      key: 'protein',
      label: 'Proteína',
      value: `${p} / ${ctx.proteinTarget} g`,
      fill: Math.min(1, p / ctx.proteinTarget),
      display: 'bar',
      tone: proteinReached ? 'win' : 'context',
    })
  }

  let overFar = false
  let over = false
  if (ctx.calorieTarget && ctx.calorieTarget > 0 && (s.calories ?? 0) > 0) {
    const c = Math.round(s.calories ?? 0)
    const t = ctx.calorieTarget
    over = c > t
    overFar = c > t * 1.2
    if (!over) {
      metrics.push({
        key: 'cal',
        label: 'Calorías',
        value: `${c}`,
        sub: `de ${t} kcal`,
        fill: c / t,
        display: 'bar',
        tone: 'context',
      })
    } else {
      metrics.push({
        key: 'cal',
        label: 'Calorías',
        value: `+${c - t}`,
        sub: 'sobre tu objetivo',
        fill: 1,
        over: Math.min(1, (c - t) / t),
        display: 'bar',
        tone: 'over',
      })
    }
  }

  if (metrics.length === 0) return null
  // The deficit verdict — the core weight signal, shown clearly. Only when
  // there's calorie data + a target to judge against.
  let status: DayCard['status']
  if (ctx.calorieTarget && ctx.calorieTarget > 0 && (s.calories ?? 0) > 0) {
    status = over
      ? { text: 'Fuera del déficit', tone: 'over' }
      : { text: 'En déficit', tone: 'context' }
  }
  const coach = overFar
    ? 'Hoy el cuerpo pidió más. ¿Algo pasó?'
    : over
      ? 'Hoy tu cuerpo tuvo lo que necesitaba.'
      : proteinReached
        ? 'Llegaste a tu proteína.'
        : 'Vas dentro de tu objetivo hoy.'
  return { key: 'comida', label: 'Comida', weight: 'hero', status, metrics, coach }
}

/* ── Agua — progress toward the daily goal ────────────────────────── */
function agua(s: DailySignals, ctx: DayReadingContext): DayCard | null {
  const g = s.water_glasses ?? 0
  if (g === 0) return null
  const goal = Math.max(1, ctx.waterGoalGlasses)
  const reached = g >= goal
  const metric: DayMetric = {
    key: 'water',
    label: 'Agua',
    value: `${g} / ${goal} vasos`,
    fill: Math.min(1, g / goal),
    display: 'bar',
    tone: reached ? 'win' : 'context',
  }
  const coach = reached
    ? 'Llegaste a tu agua del día.'
    : g >= goal / 2
      ? 'Buen ritmo.'
      : 'Vas sumando.'
  return { key: 'agua', label: 'Agua', weight: 'mid', metrics: [metric], coach }
}

/* ── Cuerpo — training (chip) + sleep (a figure, never a goal) ─────── */
function cuerpo(s: DailySignals): DayCard | null {
  const metrics: DayMetric[] = []
  if (s.trained)
    metrics.push({
      key: 'train',
      label: 'Movimiento',
      value: 'Entrenaste',
      display: 'chip',
      tone: 'win',
    })
  else if (s.rested)
    metrics.push({
      key: 'train',
      label: 'Movimiento',
      value: 'Descanso',
      display: 'chip',
      tone: 'soft',
    })

  let sleepShort = false
  let sleepOk = false
  if (s.sleep_minutes != null) {
    sleepShort = s.sleep_minutes < 360
    sleepOk = s.sleep_minutes >= 420
    metrics.push({
      key: 'sleep',
      label: 'Sueño',
      value: `${round1(s.sleep_minutes / 60)} h`,
      display: 'plain',
      tone: sleepShort ? 'soft' : 'context',
    })
  }
  if (metrics.length === 0) return null
  const coach = sleepShort
    ? 'La noche fue corta.'
    : sleepOk
      ? 'La noche alcanzó.'
      : s.trained
        ? 'Entrenaste hoy.'
        : null
  return { key: 'cuerpo', label: 'Cuerpo', weight: 'soft', metrics, coach }
}

/* ── Bienestar — energy (dots) + cycle (chip) ─────────────────────── */
function bienestar(s: DailySignals, ctx: DayReadingContext): DayCard | null {
  const metrics: DayMetric[] = []
  let energyLow = false
  let energyHigh = false
  if (s.energy != null) {
    energyLow = s.energy < 3
    energyHigh = s.energy >= 4
    metrics.push({
      key: 'energy',
      label: 'Energía',
      value: '',
      dots: Math.max(0, Math.min(5, s.energy)),
      display: 'dots',
      tone: energyLow ? 'soft' : 'context',
    })
  }
  if (s.on_period && ctx.cycleEnabled !== false)
    metrics.push({
      key: 'cycle',
      label: 'Ciclo',
      value: 'En tu periodo',
      display: 'chip',
      tone: 'context',
    })

  let coach: string | null = null
  if (s.energy != null) {
    coach = energyHigh
      ? 'Tu energía hoy viene en alza.'
      : energyLow
        ? 'Suave contigo, hoy.'
        : 'Tu energía hoy, estable.'
  } else if (s.mood) {
    coach =
      s.mood === 'good'
        ? 'Hoy te sentiste bien.'
        : s.mood === 'struggle'
          ? 'Hoy costó un poco. Está bien.'
          : 'Hoy, un día tranquilo.'
  }
  if (metrics.length === 0 && !coach) return null
  return { key: 'bienestar', label: 'Bienestar', weight: 'soft', metrics, coach }
}

/** Build the day's live readings as cards. Empty groups are dropped, so a
 *  quiet day with nothing logged returns []. */
export function buildDayReadings(today: DailySignals | null, ctx: DayReadingContext): DayCard[] {
  if (!today) return []
  return [comida(today, ctx), agua(today, ctx), cuerpo(today), bienestar(today, ctx)].filter(
    (c): c is DayCard => c != null,
  )
}
