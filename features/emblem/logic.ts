/*
 * Emblema Celeste — la lógica PURA de transformación.
 *
 * Dos sistemas independientes conviven en el hero:
 *   · Constelación del mes — presencia. Cualquier día con registro enciende
 *     una estrella; mensual, se reinicia. Responde "¿cuántos días estuve?".
 *   · Emblema Celeste — transformación personal. Persistente, nunca se
 *     reinicia, responde a la suma de hábitos. "¿En quién me estoy
 *     convirtiendo?" / "¿te cuidaste?".
 *   La constelación NO revela el emblema: un mes de solo registrar llena la
 *   constelación pero revela el emblema poco; un mes de
 *   hábitos completos lo revela más. Intencional.
 *
 * Los PUNTOS son internos — la usuaria nunca ve puntos. SÍ ve el
 * porcentaje de reveal y la etapa (decisión 2026-06-12: la tarjeta
 * "Tu transformación" los muestra para que el sistema sea legible).
 * El % solo crece — nunca castiga — y el emblema sigue revelándose
 * por etapas discretas: la transformación se siente visual.
 *
 * El total viene de fn_transform_points (Postgres, retroactivo sobre
 * daily_signals). Aquí solo se mapea puntos → progreso → etapa.
 */

/** Puntos por fuente de EVIDENCIA, una vez por día (espejo de
 *  fn_transform_points — si cambias uno, cambia el otro). Máximo 31/día. El
 *  emblema crece por evidencia (lo que crea cambio físico), NO por presencia:
 *  el déficit es el objetivo primario → el peso más alto; el sueño cuenta como
 *  EVIDENCIA de calidad (≥ 7 h), no por estar registrado. Primera comida,
 *  energía subjetiva y check-in son PRESENCIA: ya no suman al emblema. */
export const TRANSFORM_WEIGHTS = {
  deficit: 10,
  trained: 8,
  proteinTarget: 6,
  sleep7h: 4,
  waterComplete: 3,
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
  /** Voz del coach — observa la transformación, nunca exige. Es la
   *  línea CANÓNICA de la etapa (= lines[0]); úsala para a11y/fallback. */
  message: string
  /** Pool de la etapa: una etapa puede durar ~2 semanas, así que la voz
   *  rota día a día para no repetir la misma frase. Todas en positivo,
   *  todas observan — nunca exigen, nunca culpan. */
  lines: readonly [string, ...string[]]
  /** Progreso (0–100) desde el que esta etapa aplica. */
  minPct: number
}

// Las cinco etapas del reveal. El cerebro no percibe 34%→35%; percibe
// "algo apareció". Los rangos: 0–24 / 25–49 / 50–74 / 75–99 / 100 —
// alineados a los umbrales de las ceremonias T1 (25/50/75/100) para que la
// línea de etapa cambie EXACTO cuando se dispara la revelación full-screen.
// Cada etapa MATERIALIZA capas anatómicas nuevas del emblema (marco →
// jardín+cabeza → melena → oro pleno); el león aparece desde "forma"
// — desde temprano se ve QUÉ se construye — y lo ya revelado nunca se
// esconde.
export const EMBLEM_STAGES: readonly EmblemStage[] = [
  {
    key: 'despierta',
    label: 'Despierta',
    message: 'Tu {sign} está despertando.',
    lines: [
      'Tu {sign} está despertando.',
      'Algo tuyo empieza a encenderse.',
      'Cada cuidado deja una luz.',
    ],
    minPct: 0, // anillo + glifo + estrellas, en brasa
  },
  {
    key: 'forma',
    label: 'Toma forma',
    message: 'Tu {sign} empieza a tomar forma.',
    lines: [
      'Tu {sign} empieza a tomar forma.',
      'Lo que repites te está dando forma.',
      'Día a día, algo se dibuja.',
    ],
    minPct: 25, // + luna y ramas · + la cabeza del león
  },
  {
    key: 'revela',
    label: 'Se revela',
    message: 'Lo que haces cada día te está revelando.',
    lines: [
      'Lo que haces cada día te está revelando.',
      'Tu {sign} se reconoce más.',
      'Lo que sostienes, se nota.',
    ],
    minPct: 50, // + melena — el león entero, el momento "ah"
  },
  {
    key: 'casi',
    label: 'Casi completo',
    message: 'Tu {sign} ya puede verse.',
    lines: [
      'Tu {sign} ya puede verse.',
      'Casi entero, y es tuyo.',
      'Lo que construiste casi resplandece.',
    ],
    minPct: 75, // todo gana presencia, el glow despierta
  },
  {
    key: 'completo',
    label: 'Completo',
    message: 'Tu {sign} está completo. Has despertado algo propio.',
    lines: [
      'Tu {sign} está completo. Has despertado algo propio.',
      'Completo. Nada de esto se reinicia.',
    ],
    minPct: 100, // oro pleno + halo
  },
] as const

/** Reemplaza el token `{sign}` por el nombre del signo de la usuaria. El
 *  copy del emblema se guarda con `{sign}` (no "Leo") para servir a los 12
 *  signos — el arte ya es del signo real, el texto debe acompañarlo. */
export function withSign(text: string, signLabel: string): string {
  return text.replace(/\{sign\}/g, signLabel)
}

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

/** La línea del coach para HOY: ancla en la etapa vigente (la identidad
 *  estable) y rota dentro del pool de esa etapa según el día. Determinista
 *  por día — la misma todo el día, distinta mañana — para que una etapa
 *  larga (~2 semanas) no muestre la frase idéntica día tras día. `daySeed`
 *  es cualquier entero estable-por-día (p. ej. días desde epoch). Sin
 *  etapa válida (progress 0) cae a la canónica de "despierta". El copy
 *  trae el token `{sign}`; se resuelve con `signLabel` antes de devolver. */
export function dailyCoachLine(progress: number, daySeed: number, signLabel: string): string {
  const stage = stageForProgress(progress)
  const pool = stage.lines
  if (!Number.isFinite(daySeed)) return withSign(pool[0], signLabel)
  const i = ((Math.trunc(daySeed) % pool.length) + pool.length) % pool.length
  return withSign(pool[i] ?? pool[0], signLabel)
}

/** Progreso → índice DISCRETO de etapa para la capa visual:
 *  -1 = calma (0 absoluto: el despertar requiere el primer hábito),
 *  0..4 = índice en EMBLEM_STAGES. Dentro de una etapa nada se mueve;
 *  cruzarla anima la materialización de la capa nueva. */
export function stageIndexForProgress(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0) return -1
  return EMBLEM_STAGES.indexOf(stageForProgress(progress))
}

/* ── Que se sienta el revelado (dueña 6 oct 2026) ─────────────────────
 * La lógica del emblema NO cambia: esto solo la hace legible. Qué hábitos
 * sumaron un día (la causa), cuánto falta para la siguiente etapa en días
 * como los tuyos (la anticipación) y si apareció un trozo nuevo del arte.
 */

export type EvidenceKey = 'deficit' | 'trained' | 'protein' | 'sleep' | 'water'

/** Los hábitos que revelan el emblema, en orden de peso (espejo de
 *  fn_transform_points). */
export const EVIDENCE_ORDER: readonly EvidenceKey[] = [
  'deficit',
  'trained',
  'protein',
  'sleep',
  'water',
]

export const EVIDENCE_LABEL: Record<EvidenceKey, string> = {
  deficit: 'déficit',
  trained: 'entreno',
  protein: 'proteína',
  sleep: 'sueño de 7 h',
  water: 'agua',
}

const EVIDENCE_POINTS: Record<EvidenceKey, number> = {
  deficit: TRANSFORM_WEIGHTS.deficit,
  trained: TRANSFORM_WEIGHTS.trained,
  protein: TRANSFORM_WEIGHTS.proteinTarget,
  sleep: TRANSFORM_WEIGHTS.sleep7h,
  water: TRANSFORM_WEIGHTS.waterComplete,
}

export type EvidenceDay = {
  calories?: number | null
  protein_g?: number | null
  trained?: boolean | null
  sleep_minutes?: number | null
  water_glasses?: number | null
}

export type EvidenceTargets = {
  calorieTarget: number | null
  proteinTarget: number | null
  waterGoalGlasses: number
}

/** Qué hábitos cuentan ese día — la MISMA vara que fn_transform_points. */
export function dayEvidence(
  day: EvidenceDay | null | undefined,
  t: EvidenceTargets,
): EvidenceKey[] {
  if (!day) return []
  const out: EvidenceKey[] = []
  const cal = day.calories ?? 0
  if (t.calorieTarget != null && cal > 0 && cal <= t.calorieTarget && cal >= 0.6 * t.calorieTarget)
    out.push('deficit')
  if (day.trained === true) out.push('trained')
  if (t.proteinTarget != null && (day.protein_g ?? 0) >= t.proteinTarget) out.push('protein')
  if ((day.sleep_minutes ?? 0) >= 420) out.push('sleep')
  if ((day.water_glasses ?? 0) >= Math.max(1, t.waterGoalGlasses)) out.push('water')
  return out
}

export function evidencePoints(keys: readonly EvidenceKey[]): number {
  return keys.reduce((a, k) => a + EVIDENCE_POINTS[k], 0)
}

/** "déficit y proteína" / "entreno, proteína y agua". */
export function evidencePhrase(keys: readonly EvidenceKey[]): string {
  const words = EVIDENCE_ORDER.filter((k) => keys.includes(k)).map((k) => EVIDENCE_LABEL[k])
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}`
}

export type StageForecast = {
  /** La siguiente etapa (null si ya está completo). */
  next: EmblemStage | null
  /** Días "como los tuyos" que faltan; null sin ritmo reciente (no se inventa). */
  days: number | null
}

/**
 * Cuánto falta para la siguiente etapa, en días como los tuyos: los puntos
 * que faltan entre tu promedio de la última semana (días ya cerrados). Sin
 * promedio (semana sin hábitos), `days` es null: solo se nombra la etapa.
 */
export function nextStageForecast(progress: number, pointsPerDay: number): StageForecast {
  const next = EMBLEM_STAGES.find((s) => s.minPct > progress) ?? null
  if (!next) return { next: null, days: null }
  const pointsToGo = ((next.minPct - progress) / 100) * TRANSFORM_TOTAL_POINTS
  if (!(pointsPerDay > 0)) return { next, days: null }
  return { next, days: Math.max(1, Math.ceil(pointsToGo / pointsPerDay)) }
}

/** Promedio de puntos por día de los días dados (la semana reciente). */
export function averagePointsPerDay(days: readonly EvidenceDay[], t: EvidenceTargets): number {
  if (days.length === 0) return 0
  const total = days.reduce((a, d) => a + evidencePoints(dayEvidence(d, t)), 0)
  return total / days.length
}
