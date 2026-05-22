/*
 * MOCK órbita-engine output — a stand-in for what the engine will
 * generate once the Anthropic key is in. It lets the whole Tu Órbita
 * tab (Voz de Stelar, patrones, ciclo) be designed and reviewed now.
 * Mirrors features/progress/mock.ts. Delete the wiring to this file
 * when the real engine lands.
 */

/** The coach's reading for the Mes segment — plain serif narration.
 *  Día and Semana have their own richer readings below. */
export const MOCK_VOZ: Record<'mes', string> = {
  mes: 'Vas en el día 22. Los antojos más altos y el sueño más cortito son la fase lútea. Pasa todos los meses.',
}

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
      text: ' — ¿se siente así tu día? Anoche fueron cinco horas de sueño; quizá la tarde pida un poco más de calma.',
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

/** A two-line editorial headline that sits above the orbital diagram —
 *  STELAR's *angle* on the day: not a description of the diagram (the
 *  eye already reads it), but advice or an anticipation only the IA
 *  can give. The accent carries the actionable insight. */
export const MOCK_HEADLINE: { parts: readonly VozParte[] } = {
  parts: [
    { text: 'Cuerpo encendido, mente lenta. ' },
    { text: 'Lo difícil del día se mueve mejor si lo dejas para el jueves', tone: 'accent' },
    { text: '.' },
  ],
}

/** Today's "moves the needle" — STELAR picks the one action with the
 *  highest leverage given the read. Title is plain Spanish (an
 *  imperative); reason names the data that justifies it. */
export const MOCK_ACCION_DEL_DIA = {
  title: 'Dormir antes de las 23:00.',
  reason:
    'Estás en fase lútea y arrancando una semana baja en energía. Una hora más de sueño hoy te ahorra el jueves.',
}

/*
 * The Semana mock is built procedurally from per-weekday templates,
 * not stored as a static snapshot. That way the prose, archetype,
 * counts and ghosts all stay coherent regardless of what day the
 * user opens the app — the same shape the real engine will produce
 * from daily_signals. Sunday-first throughout, matching the calendar
 * and JS Date.getDay().
 */

/** A weekday's intrinsic character — what STELAR would say if this
 *  day were lived. Used by both the days array and the prose builder
 *  so today's voice and the day card never disagree. */
type WeekdayTemplate = {
  archetype: string
  brightness: number
  dimEnLuz: number
  drift: number
  /** Used when this day is today — present-voice, full sentence. */
  noteToday: string
  /** Used when this day is in the past — past-voice. */
  notePast: string
  /** A short phrase that drops in after "Hoy …". */
  vozTodayPhrase: string
  /** A short phrase that drops in after "El {weekday} …" in prose. */
  vozPastPhrase: string
}

const WEEKDAY_TEMPLATES: readonly WeekdayTemplate[] = [
  // 0. Domingo: entrada tibia, transición desde el fin de semana.
  {
    archetype: 'tibia',
    brightness: 0.58,
    dimEnLuz: 2,
    drift: 2,
    noteToday: 'Domingo arranca tibio. Lo justo para empezar.',
    notePast: 'Llegaste medio descansada del finde.',
    vozTodayPhrase: 'arrancas la semana tibia',
    vozPastPhrase: 'tibia',
  },
  // 1. Lunes: el pico clásico, descansada del finde.
  {
    archetype: 'brillante',
    brightness: 0.92,
    dimEnLuz: 5,
    drift: 1,
    noteToday: 'Hoy llegas firme. Cuerpo, mente y energía juntos.',
    notePast: 'Tu mejor día de la semana. Cuerpo, mente y energía juntos.',
    vozTodayPhrase: 'estás en uno de tus mejores días',
    vozPastPhrase: 'brillaste, fue tu día más alto',
  },
  // 2. Martes: sostén del impulso de lunes.
  {
    archetype: 'sostenida',
    brightness: 0.74,
    dimEnLuz: 4,
    drift: 1,
    noteToday: 'Hoy sigues el ritmo del lunes, un poco más bajo pero ahí.',
    notePast: 'Seguiste el ritmo del lunes, un poco más bajo pero ahí.',
    vozTodayPhrase: 'sigues el ritmo del lunes',
    vozPastPhrase: 'seguiste el ritmo del lunes',
  },
  // 3. Miércoles: el centro de gravedad, presente.
  {
    archetype: 'presente',
    brightness: 0.7,
    dimEnLuz: 4,
    drift: 1,
    noteToday: 'Hoy sigues firme. El impulso del lunes todavía dura.',
    notePast: 'Te mantuviste firme. El impulso del lunes todavía duraba.',
    vozTodayPhrase: 'el impulso del lunes todavía dura',
    vozPastPhrase: 'te mantuviste firme',
  },
  // 4. Jueves: la caída clásica del patrón "el jueves te apaga".
  {
    archetype: 'callada',
    brightness: 0.45,
    dimEnLuz: 2,
    drift: 3,
    noteToday: 'Hoy el cuerpo pide bajar. Los jueves suelen ser así.',
    notePast: 'El jueves bajó. Cuatro dimensiones quedaron tranquilas.',
    vozTodayPhrase: 'el cuerpo pide bajar',
    vozPastPhrase: 'bajaste, cuatro dimensiones tranquilas',
  },
  // 5. Viernes: liberación, otro respiro.
  {
    archetype: 'libre',
    brightness: 0.65,
    dimEnLuz: 3,
    drift: 2,
    noteToday: 'Hoy la semana afloja. El cuerpo lo siente.',
    notePast: 'La semana aflojó. El cuerpo cambió de marcha.',
    vozTodayPhrase: 'la semana afloja',
    vozPastPhrase: 'la semana aflojó',
  },
  // 6. Sábado: espacio amplio, mente y energía sueltas.
  {
    archetype: 'amplia',
    brightness: 0.72,
    dimEnLuz: 4,
    drift: 1,
    noteToday: 'Sábado largo. Hay tiempo y aire, mente y energía sueltas.',
    notePast: 'Sábado largo. Tiempo, aire, mente y energía sueltas.',
    vozTodayPhrase: 'hay margen, mente y energía sueltas',
    vozPastPhrase: 'hubo margen',
  },
]

const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
const WEEKDAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

/** Brightness threshold above which a day counts as "en luz" — the
 *  same TONE_BRILLANTE used by Día. Days under this are "lejos". */
const EN_LUZ_THRESHOLD_WEEK = 0.7

/** Build the 7-day array for the current week given today's index
 *  (0 = Sunday, JS Date.getDay()). Past days carry their template's
 *  past-voice note; today carries its today-voice note; future days
 *  are blank stations waiting to arrive. */
export function buildWeekDays(todayIdx: number): readonly DiaSemana[] {
  return Array.from({ length: 7 }, (_, i) => {
    const isFuture = i > todayIdx
    if (isFuture) {
      return {
        label: WEEKDAY_LABELS[i]!,
        weekday: WEEKDAY_NAMES[i]!,
        brightness: 0,
        today: false,
        archetype: '',
        dimEnLuz: 0,
        drift: 0,
        note: 'Aún no llega.',
      }
    }
    const tpl = WEEKDAY_TEMPLATES[i]!
    const isToday = i === todayIdx
    return {
      label: WEEKDAY_LABELS[i]!,
      weekday: WEEKDAY_NAMES[i]!,
      brightness: tpl.brightness,
      today: isToday,
      archetype: tpl.archetype,
      dimEnLuz: tpl.dimEnLuz,
      drift: tpl.drift,
      note: isToday ? tpl.noteToday : tpl.notePast,
    }
  })
}

/** Derive the week's archetype + meta counts from the lived days. */
export function buildArquetipoSemana(
  days: readonly DiaSemana[],
  todayIdx: number,
): {
  name: string
  emphasis: string
  daysEnLuz: number
  nochesRotas: number
  peakDay: string
  daysRead: number
  signals: number
  arcNumber: number
  arcTotal: number
} {
  const lived = days.slice(0, todayIdx + 1)
  const daysRead = lived.length
  const daysEnLuz = lived.filter((d) => d.brightness >= EN_LUZ_THRESHOLD_WEEK).length
  const signals = lived.reduce((s, d) => s + d.dimEnLuz + d.drift, 0) * 2
  const peak = lived.reduce((max, d) => (d.brightness > max.brightness ? d : max), lived[0]!)
  const proportion = daysEnLuz / daysRead
  const closing = todayIdx === 6
  let name = 'la semana arrancando'
  if (closing) {
    name =
      daysEnLuz >= 4
        ? 'la semana cerrándose en luz'
        : daysEnLuz >= 2
          ? 'la semana cerrándose tibia'
          : 'la semana cerrándose en silencio'
  } else if (daysRead >= 2) {
    name =
      proportion >= 0.6
        ? 'la semana en luz'
        : proportion >= 0.3
          ? 'la semana en formación'
          : 'la semana en silencio'
  }
  return {
    name,
    emphasis: 'la semana',
    daysEnLuz,
    nochesRotas: 0,
    peakDay: peak.weekday,
    daysRead,
    signals,
    arcNumber: 3,
    arcTotal: 8,
  }
}

/** Assemble the Voz de Semana prose from the lived days. The
 *  structure mirrors the original hand-written copy: a Sunday
 *  opener, a peak callout (the brightest past day excluding
 *  Sunday), the today phrase, and a future-closer when the week
 *  isn't done. Each piece is keyed to a template so the prose
 *  shifts day by day without losing voice. */
export function buildVozSemana(
  days: readonly DiaSemana[],
  todayIdx: number,
): {
  parts: readonly VozParte[]
  signature: { confidence: 'alta' | 'media' | 'baja'; scope: string }
} {
  const parts: VozParte[] = []
  const past = days.slice(0, todayIdx)
  const todayTpl = WEEKDAY_TEMPLATES[todayIdx]!
  const hasFuture = todayIdx < 6

  if (todayIdx > 0) {
    // Sunday opener — always when Sunday is past.
    const sunTpl = WEEKDAY_TEMPLATES[0]!
    parts.push({ text: 'Arrancaste el domingo ' })
    parts.push({ text: sunTpl.vozPastPhrase, tone: 'accent' })
    parts.push({ text: '. ' })

    // Peak callout — brightest past day (skipping Sunday, already
    // mentioned). Only if it's bright enough to be worth naming.
    const candidates = past.slice(1)
    if (candidates.length > 0) {
      const peak = candidates.reduce(
        (max, d) => (d.brightness > max.brightness ? d : max),
        candidates[0]!,
      )
      if (peak.brightness >= EN_LUZ_THRESHOLD_WEEK) {
        const peakIdx = WEEKDAY_LABELS.indexOf(peak.label as (typeof WEEKDAY_LABELS)[number])
        const peakTpl = WEEKDAY_TEMPLATES[peakIdx]!
        parts.push({ text: 'El ' })
        parts.push({ text: peak.weekday.toLowerCase(), tone: 'accent' })
        parts.push({ text: ` ${peakTpl.vozPastPhrase}. ` })
      }
    }
  }

  // Today's voice — always present.
  parts.push({ text: 'Hoy', tone: 'accent' })
  parts.push({ text: ` ${todayTpl.vozTodayPhrase}. ` })

  // Future-closer — only while the week isn't done.
  if (hasFuture) {
    parts.push({ text: 'El resto de la semana ' })
    parts.push({ text: 'aún se escribe', tone: 'accent' })
    parts.push({ text: '.' })
  }

  const daysRead = todayIdx + 1
  const confidence: 'alta' | 'media' | 'baja' =
    daysRead >= 5 ? 'alta' : daysRead >= 3 ? 'media' : 'baja'

  return {
    parts,
    signature: { confidence, scope: `${daysRead} ${daysRead === 1 ? 'día leído' : 'días leídos'}` },
  }
}

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

// A 28-day curve peaking around day 23 — antojos rise across the band.
const luteaBars: readonly number[] = Array.from({ length: 28 }, (_, i) => {
  const day = i + 1
  return Math.min(1, 0.18 + 0.74 * Math.exp(-((day - 23) ** 2) / 64))
})

export const MOCK_PATRONES: readonly Patron[] = [
  {
    id: 'jueves',
    category: 'recurrencia',
    title: '¿Los jueves te apagan?',
    emphasis: 'jueves',
    detail: 'Lo vimos 3 jueves seguidos.',
    data: {
      kind: 'weekday',
      focus: 3,
      week: [0.86, 0.73, 0.66, 0.31, 0.56, 0.71, 0.64],
      weeks: [
        { label: 'sem 1', bars: [0.82, 0.71, 0.68, 0.3, 0.54, 0.7, 0.62] },
        { label: 'sem 2', bars: [0.78, 0.69, 0.62, 0.29, 0.58, 0.72, 0.65] },
        { label: 'sem 3', bars: [0.86, 0.73, 0.66, 0.31, 0.56, 0.71, 0.64] },
      ],
    },
    since: 'Detectado hace 3 semanas',
    confidence: 'alta',
    caption: 'Tres semanas seguidas. Cada jueves cae.',
    legend: 'Tu jueves vive un 64 % por debajo de tu lunes.',
    voz: 'El jueves no aparece de la nada. Lo que estás viendo es el cansancio que se acumula de lunes a miércoles. Para el cuarto día tu cuerpo ya gastó casi todo.',
    correlacion:
      'Tu jueves cae más cuando tu sueño del miércoles baja de 7 h. Las tres semanas del patrón dormiste 6 h o menos esa noche.',
    experimento: {
      hint: 'Date 30 minutos más de sueño este miércoles, antes de que el jueves lo cobre.',
      action: 'STELAR vigila mi jueves',
    },
  },
  {
    id: 'lunes',
    category: 'comparacion',
    title: '¿Tus lunes brillan?',
    emphasis: 'lunes',
    detail: 'Lo vimos en 4 de tus últimos 5 lunes.',
    data: {
      kind: 'weekday',
      focus: 0,
      week: [0.92, 0.78, 0.7, 0.6, 0.62, 0.68, 0.65],
      weeks: [
        { label: 'sem 1', bars: [0.88, 0.74, 0.68, 0.59, 0.6, 0.67, 0.62] },
        { label: 'sem 2', bars: [0.82, 0.7, 0.66, 0.55, 0.58, 0.65, 0.6] },
        { label: 'sem 3', bars: [0.9, 0.77, 0.71, 0.6, 0.63, 0.7, 0.66] },
        { label: 'sem 4', bars: [0.58, 0.62, 0.65, 0.55, 0.6, 0.66, 0.62] },
        { label: 'sem 5', bars: [0.86, 0.75, 0.68, 0.58, 0.62, 0.69, 0.64] },
      ],
    },
    since: 'Detectado hace 5 semanas',
    confidence: 'alta',
    caption: 'Tus últimos 5 lunes.',
    legend: '4 de 5 lunes fueron tu día más en luz de la semana.',
    voz: 'El lunes te encuentra con el fin de semana en el cuerpo. Lo que sientes ahí es descanso recargado.',
    correlacion:
      'Tus lunes altos siguen a fines de semana donde dormiste 7 h o más las dos noches.',
    experimento: {
      hint: 'Agenda para los lunes lo que más te cuesta. Es cuando más tienes con qué.',
      action: 'Proteger mis lunes',
    },
  },
  {
    id: 'lutea',
    category: 'correlacion',
    title: '¿Antojos cerca del día 22?',
    emphasis: 'antojos',
    detail: 'Lo vimos en tus 2 últimos ciclos.',
    data: {
      kind: 'cycle',
      length: 28,
      bars: luteaBars,
      band: [20, 26],
      markDay: 22,
    },
    since: 'Detectado en tus últimos 2 ciclos',
    confidence: 'media',
    caption: 'Tus antojos a lo largo del ciclo.',
    legend: 'El pico cae del día 20 al 26. Tu fase lútea.',
    voz: 'Los antojos en lútea son la progesterona pidiendo más energía. Es la química del ciclo trabajando.',
    correlacion:
      'Coinciden con tu sueño más ligero. Esos mismos días duermes unos 40 minutos menos.',
    experimento: {
      hint: 'Del día 20 al 26, suma una colación con proteína. Adelántate al antojo.',
      action: 'Anticipar mi fase lútea',
    },
  },
  {
    id: 'sueno-entreno',
    category: 'correlacion',
    title: '¿Duermes mejor si entrenas?',
    emphasis: 'entrenas',
    detail: 'Lo vimos 4 semanas seguidas — unos 45 min más.',
    data: {
      kind: 'paired',
      groups: [
        { label: 'Entrené', avg: 7.5, unit: 'h' },
        { label: 'No entrené', avg: 6.75, unit: 'h' },
      ],
    },
    since: 'Detectado hace 4 semanas',
    confidence: 'alta',
    caption: 'Tu sueño, en promedio, los días con y sin movimiento.',
    legend: 'Entrenar te suma 45 min de sueño.',
    voz: 'Cuando entrenas, tu cuerpo llega a la noche con cansancio real. Eso ordena el sueño y duermes más profundo.',
    correlacion: 'Las noches después de entrenar duermes 45 min más que las noches sin movimiento.',
    experimento: {
      hint: 'Sostén al menos 3 entrenos por semana. Tu sueño los está pidiendo.',
      action: 'Cuidar mi ritmo',
    },
  },
]

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

// MOCK_SEMANA used to be a static snapshot tied to a specific day —
// any user opening the app on a different weekday saw a mismatch
// between the selected day and the prose. The week is now built at
// render time from buildWeekDays(todayIdx) above, so the visual and
// the voice stay coherent every day of the week.

/** The current cycle, for the Mes segment. The `band` marks the
 *  days of the current phase — it lights up the accretion disk of
 *  the TuCielo hero.
 *
 *  `cycleNumber` and `patternsConfirmed` drive the first-cycle vs
 *  mature view branch: in cycle 1 the engine has no statistical
 *  basis to confirm patterns, so TuCielo's satellites render as
 *  observations and the experimento card is suppressed. From cycle
 *  3 onward, surfaced patterns are the ones that survived FDR
 *  correction + replication across ≥2 cycles. */
export const MOCK_CICLO = {
  day: 22,
  length: 28,
  phase: 'Fase lútea',
  band: [20, 26] as const,
  note: 'Tu constelación de este ciclo se sella en 6 días.',
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
    label: 'alimento',
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
    detail: 'Lunes 7. 5 de 6 dimensiones en luz. Tu día más alto de este ciclo.',
    chart: { kind: 'daily', days: FIRST_CYCLE_DAILY, focusDay: 7, focusKind: 'peak' },
  },
  {
    id: 'valley',
    label: 'tu valle',
    shortValue: 'jueves 11',
    detail:
      'Jueves 11. Mente, energía y sueño quedaron bajas ese día. Por ahora es un día, todavía no algo que se repita.',
    chart: { kind: 'daily', days: FIRST_CYCLE_DAILY, focusDay: 11, focusKind: 'valley' },
  },
  {
    id: 'stable',
    label: 'tu ancla',
    shortValue: 'mente',
    detail:
      'Mente. Apenas se movió mientras las otras 5 subían y bajaban. Fue tu zona estable este ciclo.',
    chart: {
      kind: 'dimensionStack',
      dimensions: FIRST_CYCLE_DIMENSIONS,
      focusKey: 'mente',
    },
  },
  {
    id: 'hypothesis',
    label: 'stelar observa',
    shortValue: 'algo en los jueves',
    detail: 'Algo se mueve en tus jueves. Necesitamos 2 ciclos más para confirmarlo.',
    tentative: true,
    chart: {
      kind: 'weekday',
      // L M M J V S D — jueves is the lowest by a noticeable margin
      bars: [0.84, 0.72, 0.68, 0.38, 0.58, 0.71, 0.62],
      focus: 3,
    },
  },
]

/** First-cycle Voz de Stelar — honest about the learning state.
 *  Quotes the observed peak day, names the current phase using
 *  population-level cycle knowledge (not personal inference), and
 *  ends with the promise of confirmed patterns next cycle. */
export function buildFirstCycleVoz(
  ciclo: typeof MOCK_CICLO,
  observations: readonly Observation[],
): { parts: readonly VozParte[] } {
  const peak = observations.find((o) => o.id === 'peak')
  const remaining = Math.max(0, ciclo.length - ciclo.day)
  const phaseLower = ciclo.phase.toLowerCase().replace('fase ', '')
  return {
    parts: [
      { text: 'Este es tu ' },
      { text: 'primer ciclo', tone: 'accent' },
      {
        text: ` leído. En ${ciclo.day} días tuviste algunos brillantes y otros más callados. Tu pico fue el `,
      },
      { text: peak?.shortValue ?? '', tone: 'accent' },
      { text: '. Estás en ' },
      { text: phaseLower, tone: 'accent' },
      {
        text: '. Esta fase explica los antojos y el sueño más cortito de estos días. Por ahora Stelar está ',
      },
      { text: 'aprendiendo a leerte', tone: 'accent' },
      {
        text: `. En ${remaining} días arranca tu segundo ciclo y empezamos a confirmar lo que se repite.`,
      },
    ],
  }
}
