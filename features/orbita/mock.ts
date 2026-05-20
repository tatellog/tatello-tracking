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
  mes: 'Vas en el día 22 de tu ciclo. La fase lútea explica los antojos y el sueño ligero de estos días. No es un retroceso, es tu cuerpo en su ritmo.',
}

/** A run of the coach's reading, split so a word can carry an accent
 *  (magenta) or strong (a bold figure) weight inline. */
export type VozParte = { text: string; tone?: 'accent' | 'strong' }

/** The Día reading — a quiet line in Stelar's voice, with an
 *  accented opener that paints the body of the day. */
export const MOCK_VOZ_DIA: { parts: readonly VozParte[] } = {
  parts: [
    { text: 'Cuerpo entero, mente a media luz.', tone: 'accent' },
    { text: ' Cinco horas explican más de lo que crees. Nada de eso es tu falla.' },
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
    { text: 'Cuerpo en luz, mente en quietud. ' },
    { text: 'Hoy se mueve. Las decisiones grandes pesarán menos el jueves', tone: 'accent' },
    { text: '.' },
  ],
}

/** Today's "moves the needle" — STELAR picks the one action with the
 *  highest leverage given the read. Title is plain Spanish (an
 *  imperative); reason names the data that justifies it. */
export const MOCK_ACCION_DEL_DIA = {
  title: 'Dormir antes de las 23:00.',
  reason:
    'Tu ciclo lúteo y tu fase de baja energía coinciden. Una hora más de sueño hoy te ahorra el jueves.',
}

/** The Semana archetype — the engine names this week. For a week in
 *  progress the archetype is tentative (refined as days arrive); the
 *  stats only count days lived so far. */
export const MOCK_ARQUETIPO_SEMANA = {
  name: 'la semana arrancando en luz',
  emphasis: 'la semana',
  dateRange: 'Dom 22 al Sáb 28',
  daysEnLuz: 2,
  nochesRotas: 0,
  peakDay: 'Lunes',
  daysRead: 3,
  signals: 18,
  arcNumber: 3,
  arcTotal: 8,
}

/** The Semana reading — written across the days lived so far, plus
 *  a signature that names confidence and the comparison scope. For a
 *  week in progress the tone is "vamos así", not "cierre". */
export const MOCK_VOZ_SEMANA: { parts: readonly VozParte[] } = {
  parts: [
    { text: 'Arrancaste el domingo a media luz. El ' },
    { text: 'lunes', tone: 'accent' },
    { text: ' brillaste, cuerpo, mente y energía cerca del sol. ' },
    { text: 'Hoy', tone: 'accent' },
    { text: ' vas sólida y el ritmo está claro. El resto de la semana ' },
    { text: 'aún se escribe', tone: 'accent' },
    { text: '.' },
  ],
}

export const MOCK_VOZ_SEMANA_SIGNATURE = {
  confidence: 'alta' as const,
  scope: '3 días leídos',
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
    title: 'El jueves te apaga.',
    emphasis: 'jueves',
    detail: 'Pasa 3 semanas seguidas. Caen 4 a 5 dimensiones.',
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
    voz: 'Tu jueves no es flojera. Es el cansancio de lunes a miércoles que se acumula sin que lo notes. Para el jueves tu cuerpo ya no tiene de dónde.',
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
    title: 'Tu mejor lunes del mes.',
    emphasis: 'lunes',
    detail: '5 de 6 dimensiones en luz. 18 % sobre tu promedio.',
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
    voz: 'El lunes llegas con el fin de semana descansado en el cuerpo. No es disciplina nueva, es tu cuerpo recargado.',
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
    title: 'Día 22 → antojos.',
    emphasis: 'antojos',
    detail: '4 ciclos seguidos en tu fase lútea.',
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
    voz: 'Tus antojos de la fase lútea no son falta de control. Son tu cuerpo pidiendo más energía mientras la progesterona sube. Es biología, no debilidad.',
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
    title: 'Duermes mejor cuando entrenas.',
    emphasis: 'entrenas',
    detail: 'Duermes 45 min más cuando entrenas. 4 semanas seguidas.',
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
    voz: 'Los días que entrenas, tu cuerpo llega a la noche pidiendo descanso de verdad. Se lo das, y el movimiento le ordena el sueño.',
    correlacion: 'Las noches después de entrenar duermes 45 min más que las noches sin movimiento.',
    experimento: {
      hint: 'Sostén al menos 3 entrenos por semana. Tu sueño depende de ellos más de lo que crees.',
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

// Dom 22 → Sáb 28. Week in progress — today is Tuesday (M). Sunday
// and Monday are lived; Tuesday is the current day; Wed–Sat are
// "aún no llega" (the constellation renders them as hollow stations
// and brightness/archetype/stats are zero/empty until they arrive).
// "callada" stays in the dataset for when Thursday becomes past — a
// gentler word than "rota": the body went quiet, it didn't break.
export const MOCK_SEMANA: readonly DiaSemana[] = [
  {
    label: 'D',
    weekday: 'Domingo',
    brightness: 0.58,
    today: false,
    archetype: 'tibia',
    dimEnLuz: 2,
    drift: 2,
    note: 'Llegaste a esta semana con la del descanso a medias.',
  },
  {
    label: 'L',
    weekday: 'Lunes',
    brightness: 0.92,
    today: false,
    archetype: 'brillante',
    dimEnLuz: 5,
    drift: 1,
    note: 'El pico de tu semana. Cuerpo, mente y energía cerca del sol.',
  },
  {
    label: 'M',
    weekday: 'Martes',
    brightness: 0.78,
    today: true,
    archetype: 'sólida',
    dimEnLuz: 4,
    drift: 1,
    note: 'Vas sólida hoy y el ritmo está claro.',
  },
  {
    label: 'X',
    weekday: 'Miércoles',
    brightness: 0,
    today: false,
    archetype: '',
    dimEnLuz: 0,
    drift: 0,
    note: 'Aún no llega.',
  },
  {
    label: 'J',
    weekday: 'Jueves',
    brightness: 0,
    today: false,
    archetype: '',
    dimEnLuz: 0,
    drift: 0,
    note: 'Aún no llega.',
  },
  {
    label: 'V',
    weekday: 'Viernes',
    brightness: 0,
    today: false,
    archetype: '',
    dimEnLuz: 0,
    drift: 0,
    note: 'Aún no llega.',
  },
  {
    label: 'S',
    weekday: 'Sábado',
    brightness: 0,
    today: false,
    archetype: '',
    dimEnLuz: 0,
    drift: 0,
    note: 'Aún no llega.',
  },
]

/** The current cycle, for the Mes segment. */
export const MOCK_CICLO = {
  day: 22,
  length: 28,
  phase: 'Fase lútea',
  note: 'Tu constelación de este ciclo se sella en 6 días.',
}
