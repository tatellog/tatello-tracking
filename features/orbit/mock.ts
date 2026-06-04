/*
 * MOCK órbita-engine output — a stand-in for what the engine will
 * generate once the Anthropic key is in. It lets the whole Tu Órbita
 * tab (Voz de Stelar, patrones, ciclo) be designed and reviewed now.
 * Mirrors features/progress/mock.ts. Delete the wiring to this file
 * when the real engine lands.
 */

/** A run of the coach's reading, split so a word can carry an accent
 *  (magenta) or strong (a bold figure) weight inline. */
export type VozParte = { text: string; tone?: 'accent' | 'strong' }

/** The Día reading — Stelar observes and wonders; it doesn't
 *  pronounce. It names what the signals suggest, hedges what it
 *  can't know, and hands the verdict back to the user. */
export const MOCK_VOZ_DIA: { parts: readonly VozParte[] } = {
  parts: [
    { text: 'Cuerpo entero, mente más lenta', tone: 'accent' },
    {
      text: ', ¿se siente así tu día? Anoche fueron cinco horas de sueño; quizá la tarde pida un poco más de calma.',
    },
  ],
}

/** The archetype the engine names you with today — a recurring
 *  identity pattern. `emphasis` is the word drawn in the accent;
 *  `daysRead` is the window of data Stelar read. */
export const MOCK_ARQUETIPO = {
  name: 'la insomne lúcida',
  emphasis: 'lúcida',
  daysRead: 14,
}

/** Today's suggested move — one low-effort thing the reading hints
 *  might help. Title is a plain, period-less phrase (an offer, not a
 *  command); reason names the data behind it. */
export const MOCK_ACCION_DEL_DIA = {
  title: 'Dormir antes de las 23:00',
  reason: 'Arrancas una semana más baja en energía. Una hora más de sueño hoy te ahorra el jueves.',
}

/* buildArquetipoSemana moved to the shared intelligence lib (single
 * source for app + Edge Functions) — re-exported so existing `from
 * './mock'` imports keep working. The Día/Semana readings are now built
 * for real from daily_signals (see the shared `week.ts`); the old
 * per-weekday mock templates + buildWeekDays/buildVozSemana were
 * retired. */
export { buildArquetipoSemana } from '../../supabase/functions/_shared/intelligence/arquetipo'

/** Lowercase, sensorial verbs the engine uses to type a pattern —
 *  rendered as a quiet serif-italic tag, never as a clinical eyebrow. */
export type PatronCategory = 'recurrencia' | 'comparacion' | 'correlacion'

/** A weekday pattern — recurrencia or comparacion in a single day of
 *  the week. The card glyph shows L M M J V S D with `focus` lit; the
 *  detail screen stacks `weeks` to prove the recurrence. */
export type WeekdayData = {
  kind: 'weekday'
  /** 0..6 = L M M J V S D (Monday-first). */
  focus: number
  /** A typical week's brightness; used by the detail's wide chart. */
  week: readonly number[]
  /** Recent weeks, each with the focus day standing out — the proof. */
  weeks: readonly { label: string; bars: readonly number[] }[]
}

/** A cycle pattern — a band of days inside a 28-day cycle (e.g. lútea).
 *  The card shows the cycle as 28 dots with the band lit; the detail
 *  shows the same wider with the marked day called out. */
export type CycleData = {
  kind: 'cycle'
  length: number
  /** Per-day intensity, `length` entries. */
  bars: readonly number[]
  /** Day range that lights up (1-based, inclusive). */
  band: readonly [number, number]
  /** A single day called out inside the band. */
  markDay: number
}

/** A paired pattern — two groups compared (e.g. trained vs not). The
 *  card and detail both render two bars side by side with averages. */
export type PairedData = {
  kind: 'paired'
  groups: readonly { label: string; avg: number; unit: string }[]
}

/** A detected pattern — the engine cross-references daily_signals over
 *  weeks to find these. `emphasis` is the word drawn in the accent.
 *  `data` carries the visual the card and detail screen render. The
 *  category is a soft, lowercase tag the card whispers, never an
 *  academic label.
 */
export type Patron = {
  id: string
  category: PatronCategory
  title: string
  emphasis: string
  /** A single short sentence shown under the title — plain Spanish. */
  detail: string
  data: WeekdayData | CycleData | PairedData
  // — detail screen content —
  since: string
  confidence: 'alta' | 'media' | 'baja'
  caption: string
  legend: string
  voz: string
  correlacion: string
  experimento: { hint: string; action: string }
}

/** A day on the Semana hero's week-constellation. `brightness` (0..1)
 *  is that day's overall system state. `note` is the day's voz —
 *  serif italic, shown when the day is tapped. `archetype` is the
 *  one-word identity for that day (matches Día's archetype voice).
 *  `dimEnLuz` / `drift` are the historical dimension counts for the
 *  day. Exactly one day carries `today: true`. */
export type DiaSemana = {
  /** Single-letter weekday — D L M X J V S in Sunday-first order. */
  label: string
  /** Long name for the readout. */
  weekday: string
  brightness: number
  today: boolean
  /** A one-word identity for the day — "lúcida", "brillante", … */
  archetype: string
  /** How many of the six dimensions were en luz that day. */
  dimEnLuz: number
  /** How many drifted (lejos). */
  drift: number
  note: string
}

/** The current cycle, for the Mes segment. The `band` marks the
 *  days of the current phase — it lights up the accretion disk of
 *  the MonthSky hero.
 *
 *  `cycleNumber` and `patternsConfirmed` drive the first-cycle vs
 *  mature view branch: in cycle 1 the engine has no statistical
 *  basis to confirm patterns, so MonthSky's satellites render as
 *  observations and the experimento card is suppressed. From cycle
 *  3 onward, surfaced patterns are the ones that survived FDR
 *  correction + replication across ≥2 cycles. */
export const MOCK_CYCLE = {
  day: 22,
  length: 28,
  // The thematic "lens" of the month — used by the Mes archetype
  // ("tu primer mes en {phase}"). For first month this is always
  // "lectura" (Stelar is still learning); from cycle 3+ the engine
  // surfaces a data-derived theme (e.g. "ritmo bajo", "ascenso").
  phase: 'Lectura',
  band: [20, 26] as const,
  // Days remaining to close the current month-window of observation.
  note: 'Faltan 6 días para cerrar tu primer mes.',
  cycleNumber: 1,
  patternsConfirmed: 0,
}

/** The mini-chart that ships with each first-cycle observation —
 *  the dynamic evidence behind the label. Three shapes:
 *   · `daily`           — 22-day brightness sparkline with one
 *                         focus day (used by peak + valley)
 *   · `dimensionStack`  — 6 stacked sparklines, one per dimension,
 *                         ordered by stability. The focus dimension
 *                         is drawn magenta and clearly flatter than
 *                         the others — so "tu ancla" reads at a
 *                         glance without needing explanation.
 *   · `weekday`         — 7 bars (L M M J V S D) with one focus
 *                         weekday (the tentative jueves hypothesis) */
export type ObservationChart =
  | { kind: 'daily'; days: readonly number[]; focusDay: number; focusKind: 'peak' | 'valley' }
  | {
      kind: 'dimensionStack'
      dimensions: readonly {
        key: string
        label: string
        days: readonly number[]
        variance: number
      }[]
      focusKey: string
    }
  | { kind: 'weekday'; bars: readonly number[]; focus: number }

/** A first-cycle observation — what Stelar can honestly say with
 *  one cycle of data. Pure reflection of what the user logged, no
 *  cross-cycle inference. The `tentative` flag is for the slot
 *  that hints at a forming hypothesis, marked clearly as such. */
export type Observation = {
  id: string
  /** Short label rendered under the satellite. */
  label: string
  /** A 2-4 word value that the prose can quote (e.g. "Lunes 7"). */
  shortValue: string
  /** One-line summary that floats in the cosmos when this
   *  observation is selected — the headline next to the evidence
   *  constellation. Serif italic, ~6 words max. */
  caption: string
  /** Days in the cycle where this pattern was detected. Renders
   *  as bright pin-points on the orbital ring + connecting lines
   *  forming a sub-constellation. Optional: continuous patterns
   *  (e.g. "stable across all days") leave it undefined and just
   *  rely on the caption. */
  evidenceDays?: readonly number[]
  /** Full sentence shown when the user wants more context. */
  detail: string
  /** Visual evidence — the mini-chart shown beside the detail. */
  chart: ObservationChart
  /** When true, the satellite is dimmer + the prose treats it as
   *  hypothesis-in-formation, not as established observation. */
  tentative?: boolean
}

/** Cycle-1 daily brightness (overall system score per day). Day 7
 *  is the peak, day 11 the valley — those drive peak/valley charts. */
const FIRST_CYCLE_DAILY: readonly number[] = [
  0.55, 0.62, 0.58, 0.71, 0.66, 0.78, 0.92, 0.74, 0.69, 0.55, 0.31, 0.48, 0.62, 0.67, 0.71, 0.65,
  0.58, 0.62, 0.66, 0.71, 0.68, 0.7,
]

/** Per-dimension daily traces for the first cycle — used by the
 *  `dimensionStack` chart to show all six side by side. The flatter
 *  the line, the more stable. Mente is the visibly flattest, which
 *  is what earns it the "ancla" label. */
const FIRST_CYCLE_DIMENSIONS: readonly {
  key: string
  label: string
  days: readonly number[]
  variance: number
}[] = [
  {
    key: 'mente',
    label: 'mente',
    days: [
      0.66, 0.67, 0.65, 0.66, 0.68, 0.66, 0.67, 0.66, 0.65, 0.66, 0.64, 0.65, 0.66, 0.67, 0.66,
      0.67, 0.66, 0.65, 0.66, 0.67, 0.66, 0.65,
    ],
    variance: 0.012,
  },
  {
    key: 'cuerpo',
    label: 'cuerpo',
    days: [
      0.68, 0.72, 0.65, 0.72, 0.66, 0.71, 0.78, 0.74, 0.66, 0.62, 0.55, 0.62, 0.68, 0.72, 0.74,
      0.68, 0.66, 0.62, 0.66, 0.72, 0.68, 0.7,
    ],
    variance: 0.024,
  },
  {
    key: 'sueno',
    label: 'sueño',
    days: [
      0.65, 0.55, 0.78, 0.6, 0.72, 0.58, 0.7, 0.62, 0.55, 0.66, 0.3, 0.5, 0.62, 0.75, 0.68, 0.6,
      0.7, 0.55, 0.65, 0.7, 0.62, 0.68,
    ],
    variance: 0.038,
  },
  {
    key: 'alimento',
    label: 'comida',
    days: [
      0.55, 0.62, 0.5, 0.68, 0.55, 0.72, 0.82, 0.62, 0.5, 0.45, 0.3, 0.45, 0.55, 0.62, 0.65, 0.55,
      0.5, 0.55, 0.6, 0.65, 0.62, 0.68,
    ],
    variance: 0.052,
  },
  {
    key: 'energia',
    label: 'energía',
    days: [
      0.45, 0.62, 0.55, 0.68, 0.5, 0.72, 0.92, 0.65, 0.55, 0.42, 0.2, 0.4, 0.5, 0.62, 0.7, 0.55,
      0.48, 0.45, 0.55, 0.65, 0.6, 0.65,
    ],
    variance: 0.068,
  },
  {
    key: 'ciclo',
    label: 'ciclo',
    days: [
      0.4, 0.55, 0.62, 0.78, 0.85, 0.78, 0.92, 0.68, 0.55, 0.45, 0.35, 0.4, 0.55, 0.68, 0.72, 0.65,
      0.58, 0.62, 0.68, 0.75, 0.7, 0.72,
    ],
    variance: 0.085,
  },
]

/** Hand-crafted observations for the first cycle. The real engine
 *  will derive these from daily_signals once it ships; for now,
 *  these are illustrative and demonstrate the cycle-1 contract. */
export const MOCK_OBSERVATIONS: readonly Observation[] = [
  {
    id: 'peak',
    label: 'tu pico',
    shortValue: 'lunes 7',
    caption: 'lunes 7 · tu día más alto',
    evidenceDays: [7],
    detail: 'Lunes 7. 5 de 6 dimensiones en luz. Tu día más alto de este mes.',
    chart: { kind: 'daily', days: FIRST_CYCLE_DAILY, focusDay: 7, focusKind: 'peak' },
  },
  {
    id: 'valley',
    label: 'tu pausa',
    shortValue: 'jueves 11',
    caption: 'jueves 11 · tu día más bajo',
    evidenceDays: [11],
    detail:
      'Jueves 11: el cuerpo pidió más calma. Por ahora es un día, todavía no algo que se repita.',
    chart: { kind: 'daily', days: FIRST_CYCLE_DAILY, focusDay: 11, focusKind: 'valley' },
  },
  {
    id: 'stable',
    label: 'tu ancla',
    shortValue: 'mente',
    // No discrete evidence days — stability is continuous, not
    // episodic. The caption carries the whole story.
    caption: 'mente · 22 días estable',
    detail:
      'Mente. Apenas se movió mientras las otras 5 subían y bajaban. Fue tu zona estable este mes.',
    chart: {
      kind: 'dimensionStack',
      dimensions: FIRST_CYCLE_DIMENSIONS,
      focusKey: 'mente',
    },
  },
  {
    id: 'hypothesis',
    label: 'tu señal naciente',
    shortValue: 'algo en los jueves',
    caption: '3 jueves bajos · señal débil',
    // The thursdays of a Monday-starting cycle, but only the ones
    // that have already happened by day 22 (current). The 4th
    // jueves (day 25) is still in the future.
    evidenceDays: [4, 11, 18],
    detail: 'Algo se mueve en tus jueves. Necesitamos 2 meses más para confirmarlo.',
    tentative: true,
    chart: {
      kind: 'weekday',
      // L M M J V S D — jueves is the lowest by a noticeable margin
      bars: [0.84, 0.72, 0.68, 0.38, 0.58, 0.71, 0.62],
      focus: 3,
    },
  },
]

/** First-month Voz de Stelar — honest about the learning state.
 *  Quotes the observed peak day, names what Stelar can/can't say
 *  yet, and ends with the promise of confirmed patterns next
 *  month. NO menstrual-cycle framing — the "mes" here is a
 *  28-day observation window for pattern detection. */
export function buildFirstCycleVoz(
  cycle: typeof MOCK_CYCLE,
  observations: readonly Observation[],
): { parts: readonly VozParte[] } {
  const peak = observations.find((o) => o.id === 'peak')
  const remaining = Math.max(0, cycle.length - cycle.day)
  return {
    parts: [
      { text: 'Este es tu ' },
      { text: 'primer mes', tone: 'accent' },
      {
        text: ` leído. En ${cycle.day} días tuviste algunos brillantes y otros más callados. Tu pico fue el `,
      },
      { text: peak?.shortValue ?? '', tone: 'accent' },
      { text: '. Por ahora Stelar está ' },
      { text: 'aprendiendo a leerte', tone: 'accent' },
      {
        text: `: lo que ve son señales, no patrones confirmados. En ${remaining} días arranca tu segundo mes y empezamos a confirmar lo que se repite.`,
      },
    ],
  }
}
