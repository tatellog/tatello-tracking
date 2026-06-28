/*
 * Órbita · Día — "¿Quién fuiste hoy?" (Stelar v1, SIN IA).
 *
 * Fuente de verdad: docs/orbita-dia-redesign-spec.md. El día resuelve a UNO de
 * 7 ESTADOS — no arquetipos de personalidad, sino "qué predominó en tu evidencia
 * hoy". Todo determinístico: las fuerzas (★) salen sólo de lo registrado, y el
 * algoritmo es VISIBLE (se muestran las estrellas que lo decidieron). Nunca se
 * inventa una conclusión; nunca se etiqueta a la persona ("Hoy predominó la
 * recuperación", no "Eres disciplinada").
 *
 * Lógica pura y testeable; la capa visual la consume en DayPresent.tsx.
 */
import type { DailySignals } from './api'

export type DayStateKey =
  | 'constancia'
  | 'energia'
  | 'recuperacion'
  | 'nutricion'
  | 'equilibrio'
  | 'exploracion'
  | 'presencia'

/** Las señales cuya FUERZA (★ 0-5) decide el estado y se muestran en la
 *  transparencia. Movimiento/Recuperación/Nutrición son "duras"; Bienestar y
 *  Agua acompañan. */
export type SignalKey = 'movimiento' | 'recuperacion' | 'nutricion' | 'bienestar' | 'agua'

export type SignalStrength = { key: SignalKey; label: string; stars: number; present: boolean }

export type EvidenceItem = { label: string; detail: string }
export type AbsentItem = { key: string; label: string }

export type DayState = {
  key: DayStateKey
  /** "Hoy predominó la recuperación." */
  title: string
  /** Una frase de explicación (máx 2 líneas). */
  explanation: string
  /** Las fuerzas de las señales, orden descendente — el desglose transparente. */
  strengths: SignalStrength[]
  /** ✓ acciones registradas que respaldan el estado. */
  evidence: EvidenceItem[]
  /** ○ señales importantes sin registro (ausencia, no error). */
  absent: AbsentItem[]
  /** Frase de cierre que conecta con Órbita Semana. */
  closing: string
}

export type DayStateCtx = {
  proteinTarget?: number | null
  calorieTarget?: number | null
  waterGoalGlasses?: number
}

const HARD: ReadonlySet<SignalKey> = new Set<SignalKey>(['movimiento', 'recuperacion', 'nutricion'])
/** Una señal "fuerte" (buen resultado) a partir de ★★★. Por debajo, el día no
 *  tuvo un resultado marcado → territorio de Presencia. */
const GOOD = 3
/** Amplitud (señales presentes) para que predomine la CONSTANCIA (continuidad). */
const BREADTH_MIN = 4

const clampStars = (n: number): number => Math.max(0, Math.min(5, Math.round(n)))
const sleepHours = (min: number): number => Math.round((min / 60) * 10) / 10

/* ── Fuerzas (★ 0-5) por señal — sólo de lo registrado ───────────────── */

function movimientoStars(s: DailySignals): number {
  // Con los datos de hoy (entrenó/descansó) es casi binario; pasos/FC a futuro
  // darán gradación. Descanso activo cuenta como movimiento mínimo.
  if (s.trained === true) return 5
  if (s.rested === true) return 2
  return 0
}

function recuperacionStars(s: DailySignals): number {
  let stars = 0
  if (s.sleep_minutes != null) {
    const h = s.sleep_minutes / 60
    stars = h >= 8 ? 5 : h >= 7.25 ? 4 : h >= 6.5 ? 3 : h >= 5.5 ? 2 : 1
  }
  if (s.rested === true) stars = stars === 0 ? 2 : clampStars(stars + 1)
  return stars
}

function nutricionStars(s: DailySignals, ctx: DayStateCtx): number {
  let stars = 0
  const meals = s.meal_count ?? 0
  if (meals >= 3) stars += 2
  else if (meals >= 1) stars += 1
  if (s.protein_g != null) {
    if (ctx.proteinTarget && ctx.proteinTarget > 0) {
      if (s.protein_g >= ctx.proteinTarget) stars += 2
      else if (s.protein_g >= ctx.proteinTarget * 0.7) stars += 1
    } else if (s.protein_g > 0) {
      stars += 1
    }
  }
  // Déficit logrado: calorías registradas y por debajo (o en) la meta.
  if (ctx.calorieTarget && ctx.calorieTarget > 0 && s.calories != null && s.calories > 0) {
    if (s.calories <= ctx.calorieTarget) stars += 1
  }
  return clampStars(stars)
}

function bienestarStars(s: DailySignals): number {
  const present = [s.energy, s.mood, s.motivation, s.stress].filter((v) => v != null).length
  if (present === 0) return 0
  return clampStars(1 + present) // 1→2 … 4→5
}

function aguaStars(s: DailySignals, ctx: DayStateCtx): number {
  const glasses = s.water_glasses ?? 0
  if (glasses <= 0) return 0
  const goal = Math.max(1, ctx.waterGoalGlasses ?? 8)
  return Math.max(1, clampStars((glasses / goal) * 5))
}

const SIGNAL_LABEL: Record<SignalKey, string> = {
  movimiento: 'Movimiento',
  recuperacion: 'Recuperación',
  nutricion: 'Nutrición',
  bienestar: 'Bienestar',
  agua: 'Agua',
}

function signalPresent(key: SignalKey, s: DailySignals): boolean {
  switch (key) {
    case 'movimiento':
      return s.trained === true || s.rested === true
    case 'recuperacion':
      return s.sleep_minutes != null || s.rested === true
    case 'nutricion':
      return (s.meal_count ?? 0) > 0 || s.protein_g != null
    case 'bienestar':
      return s.energy != null || s.mood != null || s.motivation != null || s.stress != null
    case 'agua':
      return (s.water_glasses ?? 0) > 0
  }
}

/** Las 5 fuerzas del día (sin ordenar). */
export function signalStrengths(s: DailySignals, ctx: DayStateCtx = {}): SignalStrength[] {
  const stars: Record<SignalKey, number> = {
    movimiento: movimientoStars(s),
    recuperacion: recuperacionStars(s),
    nutricion: nutricionStars(s, ctx),
    bienestar: bienestarStars(s),
    agua: aguaStars(s, ctx),
  }
  return (Object.keys(stars) as SignalKey[]).map((key) => ({
    key,
    label: SIGNAL_LABEL[key],
    stars: stars[key],
    present: signalPresent(key, s),
  }))
}

/* ── Selección del estado (1/día, gana el primero) ───────────────────── */

const STATE_FOR_SIGNAL: Partial<Record<SignalKey, DayStateKey>> = {
  movimiento: 'energia',
  recuperacion: 'recuperacion',
  nutricion: 'nutricion',
}

/** Resuelve QUÉ estado predominó hoy (o null si no hubo registro). Puro. */
export function selectDayStateKey(s: DailySignals, ctx: DayStateCtx = {}): DayStateKey | null {
  const strengths = signalStrengths(s, ctx)
  const breadth = strengths.filter((x) => x.present).length
  if (breadth === 0) return null

  const sorted = [...strengths].sort((a, b) => b.stars - a.stars)
  const top = sorted[0]!
  const second = sorted[1]!
  const margin = top.stars - second.stars
  const maxStars = top.stars

  // 1 · Presencia (guard): registró ≥1 pero NINGUNA señal llegó a ★★★. Apareció
  //     sin buenos resultados — nunca avergonzar el día imperfecto.
  if (maxStars < GOOD) return 'presencia'

  // 2 · Constancia: la mayoría de las señales presentes (continuidad), gane o no
  //     un solo cluster.
  if (breadth >= BREADTH_MIN) return 'constancia'

  // 3 · Dominante DURA: una señal dura domina claro (★★★+ y margen ≥2★).
  if (margin >= 2 && HARD.has(top.key) && top.stars >= GOOD) {
    return STATE_FOR_SIGNAL[top.key]!
  }

  // 4 · Exploración: lo más fuerte fueron señales SUAVES (bienestar) — registró
  //     cómo se sintió; la app "aprendió algo nuevo".
  if (top.key === 'bienestar' && top.stars >= GOOD) return 'exploracion'

  // 5 · Equilibrio: ≥2 presentes y parejas (margen ≤1★) — nada dominó.
  if (breadth >= 2 && margin <= 1) return 'equilibrio'

  // 6 · Dominante DURA (sin margen amplio pero clara y sola).
  if (HARD.has(top.key) && top.stars >= GOOD) return STATE_FOR_SIGNAL[top.key]!

  // 7 · Fallback: presencia.
  return 'presencia'
}

/* ── Copy de cada estado (borrador · pasa por voice-and-copy) ────────── */

const STATE_COPY: Record<DayStateKey, { title: string; explanation: string }> = {
  constancia: {
    title: 'Hoy predominó la constancia.',
    explanation: 'La mayoría de tus señales estuvieron presentes hoy.',
  },
  energia: {
    title: 'Hoy predominó la energía.',
    explanation: 'Tu movimiento fue la señal más fuerte del día.',
  },
  recuperacion: {
    title: 'Hoy predominó la recuperación.',
    explanation: 'Tu descanso fue la señal más fuerte del día.',
  },
  nutricion: {
    title: 'Hoy predominó la nutrición.',
    explanation: 'Tu alimentación fue la señal más fuerte del día.',
  },
  equilibrio: {
    title: 'Hoy predominó el equilibrio.',
    explanation: 'Ninguna señal dominó: tu día estuvo parejo.',
  },
  exploracion: {
    title: 'Hoy predominó la exploración.',
    explanation: 'Registraste señales más sutiles. Son las que construyen el patrón con el tiempo.',
  },
  presencia: {
    // Paralelo a los demás ("la [sustantivo]", no "tu") y espejo de evidencia,
    // sin vara de perfección (voice-and-copy).
    title: 'Hoy predominó la presencia.',
    explanation: 'El registro estuvo presente. Las otras señales, en pausa.',
  },
}

/* ── Evidencia (✓) — sólo lo registrado ──────────────────────────────── */

function buildEvidence(s: DailySignals, ctx: DayStateCtx): EvidenceItem[] {
  const out: EvidenceItem[] = []
  if (s.trained === true) out.push({ label: 'Entrenaste', detail: 'Registrado' })
  else if (s.rested === true) out.push({ label: 'Descansaste', detail: 'Registrado' })
  if (s.sleep_minutes != null) {
    out.push({ label: 'Dormiste', detail: `${sleepHours(s.sleep_minutes)} horas` })
  }
  if (
    ctx.calorieTarget &&
    ctx.calorieTarget > 0 &&
    s.calories != null &&
    s.calories > 0 &&
    s.calories <= ctx.calorieTarget
  ) {
    // Espejo de evidencia, sin verbo de esfuerzo evaluativo (voice-and-copy).
    out.push({
      label: 'Tu déficit del día',
      detail: `${Math.round(s.calories)} / ${Math.round(ctx.calorieTarget)} kcal`,
    })
  }
  if (
    ctx.proteinTarget &&
    ctx.proteinTarget > 0 &&
    s.protein_g != null &&
    s.protein_g >= ctx.proteinTarget
  ) {
    // "Cumpliste" es evaluativo (prohibido en la voz v3.0) → descriptivo.
    out.push({
      label: 'Tu proteína estuvo en objetivo',
      detail: `${Math.round(s.protein_g)} / ${Math.round(ctx.proteinTarget)} g`,
    })
  }
  if ((s.meal_count ?? 0) > 0) {
    const n = s.meal_count!
    out.push({ label: 'Registraste tus comidas', detail: `${n} ${n === 1 ? 'comida' : 'comidas'}` })
  }
  if (s.energy != null || s.mood != null || s.motivation != null || s.stress != null) {
    const detail = s.energy != null ? `Energía ${s.energy}/5` : 'Anotado'
    out.push({ label: 'Registraste cómo te sentiste', detail })
  }
  if ((s.water_glasses ?? 0) > 0) {
    const n = s.water_glasses!
    out.push({ label: 'Tomaste agua', detail: `${n} ${n === 1 ? 'vaso' : 'vasos'}` })
  }
  if (s.weight_kg != null) {
    out.push({ label: 'Registraste tu peso', detail: `${s.weight_kg.toFixed(1)} kg` })
  }
  if (s.on_period === true) out.push({ label: 'Registraste tu ciclo', detail: 'Día de ciclo' })
  return out
}

/* ── Señales ausentes (○) — ausencia, no error ───────────────────────── */

const ABSENT_CANDIDATES: { key: string; label: string; present: (s: DailySignals) => boolean }[] = [
  { key: 'sueno', label: 'Sueño', present: (s) => s.sleep_minutes != null },
  { key: 'comida', label: 'Comida', present: (s) => (s.meal_count ?? 0) > 0 },
  { key: 'agua', label: 'Agua', present: (s) => (s.water_glasses ?? 0) > 0 },
  {
    key: 'animo',
    label: 'Estado de ánimo',
    present: (s) => s.mood != null || s.energy != null || s.motivation != null,
  },
  { key: 'ciclo', label: 'Ciclo', present: (s) => s.on_period === true },
]

function buildAbsent(s: DailySignals): AbsentItem[] {
  return ABSENT_CANDIDATES.filter((c) => !c.present(s)).map((c) => ({ key: c.key, label: c.label }))
}

/* ── Cierre — rota por fecha, estable ────────────────────────────────── */

const CLOSING_LINES = [
  'Cada señal de hoy formará parte de tu órbita semanal.',
  'Mañana tu historia continuará.',
  'Una señal por sí sola dice poco. Varias comienzan a mostrar un patrón.',
] as const

function closingFor(day: string | null | undefined): string {
  const n = day ? Number(day.slice(8, 10)) : 1
  return CLOSING_LINES[(Number.isFinite(n) ? n : 1) % CLOSING_LINES.length]!
}

/* ── Ensamblado ──────────────────────────────────────────────────────── */

/** El estado completo del día (o null si no hubo ningún registro). Puro. */
export function buildDayState(s: DailySignals | null, ctx: DayStateCtx = {}): DayState | null {
  if (s == null) return null
  const key = selectDayStateKey(s, ctx)
  if (key == null) return null
  const copy = STATE_COPY[key]
  return {
    key,
    title: copy.title,
    explanation: copy.explanation,
    strengths: signalStrengths(s, ctx).sort((a, b) => b.stars - a.stars),
    evidence: buildEvidence(s, ctx),
    absent: buildAbsent(s),
    closing: closingFor(s.day),
  }
}
