/*
 * MOCK órbita-engine output — a stand-in for what the engine will
 * generate once the Anthropic key is in. It lets the whole Tu Órbita
 * tab (Voz de Stelar, patrones, ciclo) be designed and reviewed now.
 * Mirrors features/progress/mock.ts. Delete the wiring to this file
 * when the real engine lands.
 */

/** The coach's reading for each segment — serif-italic narration. */
export const MOCK_VOZ: Record<'dia' | 'semana' | 'mes', string> = {
  dia: 'Hoy tu cuerpo entrenó y comiste bien — pero dormiste seis horas, y tu energía lo resiente. No es falta de disciplina: tu sistema te pide una noche entera.',
  semana:
    'Brillaste de lunes a miércoles y te apagaste el jueves — igual que las últimas tres semanas. Tu jueves no es flojera; es lo que se acumula pidiendo descanso.',
  mes: 'Vas en el día 22 de tu ciclo. La fase lútea explica los antojos y el sueño ligero de estos días. No es un retroceso — es tu cuerpo en su ritmo.',
}

/** A detected pattern — the engine cross-references daily_signals over
 *  weeks to find these. `emphasis` is the word drawn in the accent. */
export type Patron = {
  id: string
  title: string
  emphasis: string
  detail: string
  kind: 'bars' | 'curve' | 'pulse'
}

export const MOCK_PATRONES: readonly Patron[] = [
  {
    id: 'jueves',
    title: 'El jueves te apaga.',
    emphasis: 'jueves',
    detail: '3 SEMANAS SEGUIDAS',
    kind: 'bars',
  },
  {
    id: 'lunes',
    title: 'Tus lunes brillan.',
    emphasis: 'lunes',
    detail: 'TU MEJOR ENERGÍA · 4 DE 5',
    kind: 'bars',
  },
  {
    id: 'lutea',
    title: 'Antojos en tu fase lútea.',
    emphasis: 'lútea',
    detail: 'DEL DÍA 20 AL 26 DEL CICLO',
    kind: 'curve',
  },
  {
    id: 'sueno-entreno',
    title: 'Duermes mejor cuando entrenas.',
    emphasis: 'entrenas',
    detail: '+45 MIN EN PROMEDIO',
    kind: 'pulse',
  },
]

/** A day on the Semana hero's week-ring. `brightness` (0..1) is that
 *  day's overall system state — the engine will derive it; here it is
 *  mock. `note` is the readout shown when the day is tapped. */
export type DiaSemana = {
  label: string
  brightness: number
  today: boolean
  note: string
}

export const MOCK_SEMANA: readonly DiaSemana[] = [
  {
    label: 'L',
    brightness: 0.86,
    today: false,
    note: 'Lunes — tu día más en luz: dormiste bien y entrenaste.',
  },
  {
    label: 'M',
    brightness: 0.73,
    today: false,
    note: 'Martes — sólido, energía estable todo el día.',
  },
  {
    label: 'M',
    brightness: 0.66,
    today: false,
    note: 'Miércoles — el ritmo empezó a pesar un poco.',
  },
  {
    label: 'J',
    brightness: 0.31,
    today: false,
    note: 'Jueves — te apagaste: poco sueño y ánimo bajo.',
  },
  { label: 'V', brightness: 0.56, today: false, note: 'Viernes — recuperando de a poco.' },
  { label: 'S', brightness: 0.71, today: false, note: 'Sábado — descanso, energía al alza.' },
  { label: 'D', brightness: 0.64, today: true, note: 'Hoy — tu sistema está sereno.' },
]

/** The current cycle, for the Mes segment. */
export const MOCK_CICLO = {
  day: 22,
  length: 28,
  phase: 'Fase lútea',
  note: 'Tu constelación de este ciclo se sella en 6 días.',
}
