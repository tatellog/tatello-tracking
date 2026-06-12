/*
 * Emblema Celeste — la lógica PURA de transformación.
 *
 * Dos sistemas independientes conviven en el hero:
 *   · Constelación natal — disciplina física. Solo "Entrené", mensual,
 *     se reinicia. Responde "¿cuánto me moví este mes?" / "¿te moviste?".
 *   · Emblema Celeste — transformación personal. Persistente, nunca se
 *     reinicia, responde a la suma de hábitos. "¿En quién me estoy
 *     convirtiendo?" / "¿te cuidaste?".
 *   La constelación NO revela el emblema: un mes de puro gym llena la
 *   constelación pero revela el emblema solo moderadamente; un mes de
 *   hábitos completos lo revela más. Intencional.
 *
 * Los PUNTOS son internos — la usuaria jamás ve un número, ve etapas:
 * algo apareció, algo cambió, algo se reveló. La transformación se
 * siente visual, no matemática (por eso etapas discretas, no %).
 *
 * El total viene de fn_transform_points (Postgres, retroactivo sobre
 * daily_signals). Aquí solo se mapea puntos → progreso → etapa.
 */

/** Puntos por fuente, una vez por día (espejo de fn_transform_points —
 *  si cambias uno, cambia el otro). Máximo 30/día. Entrenar pesa más,
 *  pero una usuaria que se cuida a diario avanza aunque no entrene. */
export const TRANSFORM_WEIGHTS = {
  trained: 10,
  firstMeal: 3,
  proteinTarget: 6,
  sleepLogged: 4,
  waterComplete: 3,
  energyLogged: 2,
  dailyCheckin: 2,
} as const

/** Puntos para revelar el emblema completo (100%). Con ~15-18 pts/día
 *  de una usuaria constante: ~5-6 semanas. Tras el 100% los puntos
 *  siguen acumulando (la RPC no capa) — alimentarán el arco
 *  Despertar → Alma Celeste con la misma mecánica. */
export const TRANSFORM_TOTAL_POINTS = 600

export type EmblemStageKey = 'despierta' | 'forma' | 'revela' | 'casi' | 'completo'

export type EmblemStage = {
  key: EmblemStageKey
  label: string
  /** Voz del coach — observa la transformación, nunca exige. */
  message: string
  /** Progreso (0–100) desde el que esta etapa aplica. */
  minPct: number
}

// Las cinco etapas del reveal. El cerebro no percibe 34%→35%; percibe
// "algo apareció". Los rangos: 0–25 / 26–50 / 51–75 / 76–99 / 100.
// Cada etapa MATERIALIZA capas anatómicas nuevas del emblema (ver
// RevealedLeoEmblem: marco → jardín+cabeza → melena → oro pleno); el
// león aparece desde "forma" — desde temprano se ve QUÉ se construye —
// y lo ya revelado nunca se esconde.
export const EMBLEM_STAGES: readonly EmblemStage[] = [
  {
    key: 'despierta',
    label: 'Despierta',
    message: 'Tu Leo está despertando.',
    minPct: 0, // anillo + glifo + estrellas, en brasa
  },
  {
    key: 'forma',
    label: 'Toma forma',
    message: 'Tu Leo empieza a tomar forma.',
    minPct: 26, // + luna y ramas · + la cabeza del león
  },
  {
    key: 'revela',
    label: 'Se revela',
    message: 'Tu disciplina revela quién eres.',
    minPct: 51, // + melena — el león entero, el momento "ah"
  },
  {
    key: 'casi',
    label: 'Casi completo',
    message: 'Tu Leo ya puede verse.',
    minPct: 76, // todo gana presencia, el glow despierta
  },
  {
    key: 'completo',
    label: 'Completo',
    message: 'Tu Leo está completo. Has despertado algo propio.',
    minPct: 100, // oro pleno + halo
  },
] as const

/** Puntos acumulados → progreso 0–100. Floor a propósito: 599/600 es
 *  99 — "completo" solo cuando de verdad se completó. Clamp en ambos
 *  extremos (los puntos siguen creciendo tras el 100%). */
export function transformProgressForPoints(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0
  return Math.min(100, Math.floor((points / TRANSFORM_TOTAL_POINTS) * 100))
}

/** Etapa vigente para un progreso dado (0–100). */
export function stageForProgress(progress: number): EmblemStage {
  const pct = Math.min(100, Math.max(0, progress))
  let current = EMBLEM_STAGES[0] as EmblemStage
  for (const stage of EMBLEM_STAGES) {
    if (pct >= stage.minPct) current = stage
  }
  return current
}

/** Progreso → índice DISCRETO de etapa para la capa visual:
 *  -1 = calma (0 absoluto: el despertar requiere el primer hábito),
 *  0..4 = índice en EMBLEM_STAGES. Dentro de una etapa nada se mueve;
 *  cruzarla anima la materialización de la capa nueva. */
export function stageIndexForProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return -1
  return EMBLEM_STAGES.indexOf(stageForProgress(progress))
}
