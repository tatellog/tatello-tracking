/*
 * Shared intelligence types — the SINGLE SOURCE of the deterministic
 * business rules, imported by BOTH the app (Metro) and the Edge Functions
 * (Deno). Pure TypeScript: no React Native, no Supabase client, no Deno
 * globals, only relative imports. Keep it that way.
 *
 * `DailySignals` here is a STRUCTURAL subset of the daily_signals view row
 * (the columns the detectors read). The generated app type is a superset,
 * so app code passes it straight in.
 */

/** One row of the daily_signals view — every órbita signal for a local day. */
export type DailySignals = {
  day: string | null
  sleep_minutes: number | null
  sleep_quality: number | null
  energy: number | null
  motivation: number | null
  stress: number | null
  mood: string | null
  protein_g: number | null
  calories: number | null
  meal_count: number | null
  trained: boolean | null
  workout_type: string | null
  weight_kg: number | null
  water_glasses: number | null
  rested: boolean | null
  on_period: boolean | null
}

/** Slim meal shape — the night detector only needs the timestamp. */
export type Meal = { consumed_at: string | null }

/* ── Dimensions ──────────────────────────────────────────────────── */
export type DimensionKey = 'cuerpo' | 'energia' | 'mente' | 'alimento' | 'sueno' | 'ciclo'

export type DimensionLayout = {
  key: DimensionKey
  label: string
  angleDeg: number
  radiusFrac: number
}

export type Dimension = DimensionLayout & {
  /** 0 (lejos) … 1 (en luz). */
  brightness: number
  /** One-word state caption ("clara", "corto") or null when quiet. */
  word: string | null
}

/** One of the seven day-stars in the Semana constellation. */
export type DiaSemana = {
  label: string
  weekday: string
  brightness: number
  today: boolean
  archetype: string
  dimEnLuz: number
  drift: number
  note: string
}

export type DimensionContext = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

export type DimensionMonth = {
  key: DimensionKey
  label: string
  avg: number
  delta: number
  trend: 'up' | 'down' | 'flat'
}

export type MonthSatelliteKind = 'peak' | 'valley' | 'stable' | 'tentative' | 'rising'
export type MonthSatellite = {
  id: string
  kind: MonthSatelliteKind
  label: string
  caption: string
  detail: string
  tentative: boolean
}

/* ── The written voice ───────────────────────────────────────────── */
export type VozParte = { text: string; tone?: 'accent' | 'strong' }

/* ── Patterns (the detected órbitas) ─────────────────────────────── */
export type PatronCategory = 'recurrencia' | 'comparacion' | 'correlacion'

export type WeekdayData = {
  kind: 'weekday'
  focus: number
  week: readonly number[]
  weeks: readonly { label: string; bars: readonly number[] }[]
}

export type CycleData = {
  kind: 'cycle'
  length: number
  bars: readonly number[]
  band: readonly [number, number]
  markDay: number
}

export type PairedData = {
  kind: 'paired'
  groups: readonly { label: string; avg: number; unit: string }[]
}

export type Patron = {
  id: string
  category: PatronCategory
  title: string
  emphasis: string
  detail: string
  data: WeekdayData | CycleData | PairedData
  since: string
  confidence: 'alta' | 'media' | 'baja'
  caption: string
  legend: string
  voz: string
  correlacion: string
  experimento: { hint: string; action: string }
}

/* ── Día: "Cómo va tu día" live readings ─────────────────────────── */
export type DayTone = 'win' | 'context' | 'over' | 'soft'
export type DayMetricDisplay = 'bar' | 'plain' | 'dots' | 'chip'
export type DayCardWeight = 'hero' | 'mid' | 'soft'

export type DayMetric = {
  key: string
  label: string
  value: string
  sub?: string
  fill?: number
  over?: number
  dots?: number
  display: DayMetricDisplay
  tone: DayTone
}

export type DayCard = {
  key: string
  label: string
  weight: DayCardWeight
  status?: { text: string; tone: DayTone }
  metrics: DayMetric[]
  coach: string | null
}

export type DayReadingContext = {
  calorieTarget: number | null
  proteinTarget: number | null
  waterGoalGlasses: number
}

/* The Día header identity — a real, one-word state for TODAY derived from
 * the live dimensions. `emphasis` is the substring EmText italicizes;
 * `enLuz` is the honest count of dimensions currently lit. Never a grade:
 * "por encender" is forming, not failure. */
export type DayIdentity = {
  name: string
  emphasis: string
  enLuz: number
}

/* The Semana recap — this week's log totals, the "registros de esta semana".
 * Averages are over the days that actually carry that signal (null when
 * none yet), so a blank metric reads as "sin dato", never as zero/failure. */
export type WeekRecap = {
  entrenos: number
  sleepAvgMin: number | null
  meals: number
  waterAvg: number | null
}

/* One day inside an observation's detail — the weekday, its value, and an
 * optional delta vs target ("+400"). Powers the "Los días" list. */
export type WeekObservationEntry = {
  dayIdx: number // Sunday-first 0..6
  value: string
  delta?: string
}

/* A within-week micro-observation — a concrete fact about THIS week's actual
 * days. NOT a recurrence (those need a month and live in Mes); just what
 * happened, named by weekday. Now a tappable card: `title`/`emphasis` are the
 * bold hero, `detail` the one-line subtitle, `days` light the mini week-glyph,
 * and `entries`/`voz` fill the detail screen. `state` is 'win' (glyph in
 * dimension color + halo) or 'watch' (glyph in oro — never red). */
export type WeekObservation = {
  key: string
  dimension: DimensionKey
  state: 'win' | 'watch'
  title: string
  emphasis: string
  tag: string
  detail: string
  days: number[] // Sunday-first indices involved
  entries: WeekObservationEntry[]
  voz: string
}
