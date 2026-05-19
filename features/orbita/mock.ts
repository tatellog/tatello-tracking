/*
 * MOCK órbita-engine output — a stand-in for what the engine will
 * generate once the Anthropic key is in. It lets the whole Tu Órbita
 * tab (Voz de Stelar, patrones, ciclo) be designed and reviewed now.
 * Mirrors features/progress/mock.ts. Delete the wiring to this file
 * when the real engine lands.
 */

/** The coach's reading for the Semana / Mes segments — plain serif
 *  narration. Día has its own richer reading (MOCK_VOZ_DIA). */
export const MOCK_VOZ: Record<'semana' | 'mes', string> = {
  semana:
    'Brillaste de lunes a miércoles y te apagaste el jueves, igual que las últimas tres semanas. Tu jueves no es flojera. Es lo que se acumula pidiendo descanso.',
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

/** One bar of a pattern's evidence chart. `v` is the 0..1 height;
 *  `mark` flags the days the pattern is about (drawn in the accent). */
export type EvidenceBar = { v: number; mark?: boolean; label?: string }

/** A detected pattern — the engine cross-references daily_signals over
 *  weeks to find these. `emphasis` is the word drawn in the accent.
 *  The card shows title + detail; tapping it opens the rest: the
 *  evidence chart, the coach's why, the correlation and an experiment.
 */
export type Patron = {
  id: string
  title: string
  emphasis: string
  detail: string
  kind: 'bars' | 'curve' | 'pulse'
  // — what the detail view ([id].tsx) shows —
  since: string
  confidence: 'alta' | 'media'
  evidence: { caption: string; bars: readonly EvidenceBar[]; legend: string }
  voz: string
  correlacion: string
  experimento: { hint: string; action: string }
}

// Antojos rise toward the luteal peak (~day 23); days 20–26 are the band.
const luteaBars: readonly EvidenceBar[] = Array.from({ length: 28 }, (_, i) => {
  const day = i + 1
  return {
    v: Math.min(1, 0.18 + 0.74 * Math.exp(-((day - 23) ** 2) / 64)),
    mark: day >= 20 && day <= 26,
  }
})

export const MOCK_PATRONES: readonly Patron[] = [
  {
    id: 'jueves',
    title: 'El jueves te apaga.',
    emphasis: 'jueves',
    detail: '3 SEMANAS SEGUIDAS',
    kind: 'bars',
    since: 'Detectado hace 3 semanas',
    confidence: 'alta',
    evidence: {
      caption: 'Una semana típica. El jueves cae solo.',
      bars: [
        { v: 0.86, label: 'L' },
        { v: 0.73, label: 'M' },
        { v: 0.66, label: 'M' },
        { v: 0.31, mark: true, label: 'J' },
        { v: 0.56, label: 'V' },
        { v: 0.71, label: 'S' },
        { v: 0.64, label: 'D' },
      ],
      legend: 'Tu jueves vive un 64 % por debajo de tu lunes.',
    },
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
    title: 'Tus lunes brillan.',
    emphasis: 'lunes',
    detail: 'TU MEJOR ENERGÍA · 4 DE 5',
    kind: 'bars',
    since: 'Detectado hace 5 semanas',
    confidence: 'alta',
    evidence: {
      caption: 'Tus últimos 5 lunes.',
      bars: [
        { v: 0.88, mark: true },
        { v: 0.82, mark: true },
        { v: 0.9, mark: true },
        { v: 0.58 },
        { v: 0.86, mark: true },
      ],
      legend: '4 de 5 fueron tu día más en luz de la semana.',
    },
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
    title: 'Antojos en tu fase lútea.',
    emphasis: 'lútea',
    detail: 'DEL DÍA 20 AL 26 DEL CICLO',
    kind: 'curve',
    since: 'Detectado en tus últimos 2 ciclos',
    confidence: 'media',
    evidence: {
      caption: 'Tus antojos a lo largo del ciclo.',
      bars: luteaBars,
      legend: 'El pico cae del día 20 al 26. Tu fase lútea.',
    },
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
    title: 'Duermes mejor cuando entrenas.',
    emphasis: 'entrenas',
    detail: '+45 MIN EN PROMEDIO',
    kind: 'pulse',
    since: 'Detectado hace 4 semanas',
    confidence: 'alta',
    evidence: {
      caption: 'Tus últimos 10 días. Los marcados son los que entrenaste.',
      bars: [
        { v: 0.62, mark: true },
        { v: 0.48 },
        { v: 0.84, mark: true },
        { v: 0.54 },
        { v: 0.9, mark: true },
        { v: 0.58 },
        { v: 0.5 },
        { v: 0.8, mark: true },
        { v: 0.86, mark: true },
        { v: 0.6 },
      ],
      legend: 'Entrenar te suma 45 min de sueño en promedio.',
    },
    voz: 'Los días que entrenas, tu cuerpo llega a la noche pidiendo descanso de verdad. Se lo das, y el movimiento le ordena el sueño.',
    correlacion: 'Las noches después de entrenar duermes 45 min más que las noches sin movimiento.',
    experimento: {
      hint: 'Sostén al menos 3 entrenos por semana. Tu sueño depende de ellos más de lo que crees.',
      action: 'Cuidar mi ritmo',
    },
  },
]

/** A day on the Semana hero's week-spiral. `brightness` (0..1) is that
 *  day's overall system state — the engine will derive it; here it is
 *  mock. `note` is the readout shown when the day is tapped. Exactly
 *  one day carries `today: true`; the days after it are still to come
 *  (the spiral renders them as hollow stations, brightness ignored). */
export type DiaSemana = {
  label: string
  brightness: number
  today: boolean
  note: string
}

// Week in progress — today is Tuesday; Wed–Sun have not happened yet.
export const MOCK_SEMANA: readonly DiaSemana[] = [
  {
    label: 'L',
    brightness: 0.86,
    today: false,
    note: 'Arrancaste la semana en luz. Dormiste bien y entrenaste.',
  },
  {
    label: 'M',
    brightness: 0.7,
    today: true,
    note: 'Hoy vas sólida, tu energía se sostiene.',
  },
  { label: 'M', brightness: 0, today: false, note: 'Aún no llega.' },
  { label: 'J', brightness: 0, today: false, note: 'Aún no llega.' },
  { label: 'V', brightness: 0, today: false, note: 'Aún no llega.' },
  { label: 'S', brightness: 0, today: false, note: 'Aún no llega.' },
  { label: 'D', brightness: 0, today: false, note: 'Aún no llega.' },
]

/** The current cycle, for the Mes segment. */
export const MOCK_CICLO = {
  day: 22,
  length: 28,
  phase: 'Fase lútea',
  note: 'Tu constelación de este ciclo se sella en 6 días.',
}
