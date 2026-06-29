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

export type SignalStrength = {
  key: SignalKey
  label: string
  stars: number
  present: boolean
  /** El dato real registrado (p. ej. "7.8 h", "1 comida", "Energía 3/5") — para
   *  mostrar evidencia concreta, no un puntaje abstracto. */
  detail?: string
}

/** Tono de cada evidencia = el color de SU dimensión (la capa visual lo resuelve
 *  a hex). Hace de "LA EVIDENCIA" un cielo multicolor, no una lista monocroma. */
export type EvidenceTone =
  | 'cuerpo'
  | 'sueno'
  | 'alimento'
  | 'ciclo'
  | 'energia'
  | 'mente'
  | 'proteina'
  | 'agua'
  | 'leche'

export type EvidenceItem = {
  label: string
  /** Dato real (p. ej. "7.5 horas"). undefined si no hay cifra: el verbo basta
   *  como evidencia (no inventar "Registrado"/"Anotado" de relleno). */
  detail?: string
  tone: EvidenceTone
  /** La señal a la que pertenece (para resaltar la del driver del estado). */
  signal?: SignalKey
}
export type AbsentItem = { key: string; label: string }

export type DayState = {
  key: DayStateKey
  /** "Hoy predominó la recuperación." */
  title: string
  /** Una frase de explicación (máx 2 líneas). */
  explanation: string
  /** La señal que CAUSÓ el estado (la que se resalta al explicar el porqué), o
   *  null cuando el estado no nace de una sola señal (constancia = amplitud,
   *  equilibrio = nada dominó, presencia = sólo registro). El resaltado debe
   *  seguir ESTO, no "la de más estrellas" (si no, contradice la razón). */
  driver: SignalKey | null
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
// Una escala 1-5 → palabra (energía, motivación, calma). Clara, no poética.
const qualWord = (n: number): string => (n >= 4 ? 'alta' : n === 3 ? 'media' : 'baja')
const energyWord = qualWord
const moodWord = (m: string): string =>
  m === 'good' ? 'bien' : m === 'neutral' ? 'neutral' : 'en lucha'

/** Resumen humano del check-in de bienestar: el label dice CÓMO se sintió (lo más
 *  legible), el detalle resume lo demás que registró (hasta 2 métricas). Hace que
 *  "registraste cómo te sentiste" muestre el dato real, no un verbo vacío. */
function wellbeingEvidence(s: DailySignals): { label: string; detail?: string } {
  const extras: string[] = []
  if (s.energy != null) extras.push(`energía ${qualWord(s.energy)}`)
  if (s.stress != null) extras.push(`calma ${qualWord(6 - s.stress)}`)
  else if (s.motivation != null) extras.push(`motivación ${qualWord(s.motivation)}`)
  const joined = extras.slice(0, 2).join(' · ')
  const detail = joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : undefined
  return s.mood != null
    ? { label: `Te sentiste ${moodWord(s.mood)}`, detail }
    : { label: 'Registraste cómo te sentiste', detail }
}

/** Piso de cordura del déficit (manifiesto · línea roja): NUNCA celebrar como
 *  evidencia positiva una ingesta muy por debajo de la meta — eso premiaría la
 *  restricción extrema. Sólo cuenta como "déficit del día" si está EN déficit
 *  pero por encima del 60% de la meta. Debajo, no es logro: no se muestra. */
const DEFICIT_FLOOR_RATIO = 0.6
function healthyDeficit(s: DailySignals, ctx: DayStateCtx): boolean {
  if (!ctx.calorieTarget || ctx.calorieTarget <= 0) return false
  if (s.calories == null || s.calories <= 0) return false
  return s.calories <= ctx.calorieTarget && s.calories >= ctx.calorieTarget * DEFICIT_FLOOR_RATIO
}

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
  // Déficit SANO (no restricción extrema, ver healthyDeficit).
  if (healthyDeficit(s, ctx)) stars += 1
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

/** El dato real registrado de cada señal (factual, no puntaje). undefined si no
 *  hay registro. */
function signalDetail(key: SignalKey, s: DailySignals): string | undefined {
  switch (key) {
    case 'movimiento':
      if (s.trained === true) return 'Entrenaste'
      if (s.rested === true) return 'Descanso activo'
      return undefined
    case 'recuperacion':
      if (s.sleep_minutes != null) return `${sleepHours(s.sleep_minutes)} h`
      if (s.rested === true) return 'Descansaste'
      return undefined
    case 'nutricion': {
      const meals = s.meal_count ?? 0
      if (meals > 0) return `${meals} ${meals === 1 ? 'comida' : 'comidas'}`
      if (s.protein_g != null) return `${Math.round(s.protein_g)} g proteína`
      return undefined
    }
    case 'bienestar':
      // Cualitativo, no "x/5" (la spec prohíbe el puntaje desnudo en el modal).
      if (s.energy != null) return `Energía ${energyWord(s.energy)}`
      if (s.mood != null || s.motivation != null || s.stress != null) return 'Registrado'
      return undefined
    case 'agua': {
      const g = s.water_glasses ?? 0
      if (g > 0) return `${g} ${g === 1 ? 'vaso' : 'vasos'}`
      return undefined
    }
  }
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
    detail: signalDetail(key, s),
  }))
}

/* ── Selección del estado (1/día, gana el primero) ───────────────────── */

const STATE_FOR_SIGNAL: Partial<Record<SignalKey, DayStateKey>> = {
  movimiento: 'energia',
  recuperacion: 'recuperacion',
  nutricion: 'nutricion',
}

/** La señal que CAUSA cada estado (para resaltarla al explicar el porqué). Los
 *  estados que NO nacen de una sola señal son null: constancia (la decide la
 *  amplitud), equilibrio (nada dominó) y presencia (sólo el registro). */
const STATE_DRIVER: Record<DayStateKey, SignalKey | null> = {
  energia: 'movimiento',
  recuperacion: 'recuperacion',
  nutricion: 'nutricion',
  exploracion: 'bienestar',
  constancia: null,
  equilibrio: null,
  presencia: null,
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

// Misma observación en PASADO, para ver un día pasado desde Semana ("Ese día…"
// en vez de "Hoy…"). Mismo significado, sin culpa.
const STATE_COPY_PAST: Record<DayStateKey, { title: string; explanation: string }> = {
  constancia: {
    title: 'Ese día predominó la constancia.',
    explanation: 'La mayoría de tus señales estuvieron presentes.',
  },
  energia: {
    title: 'Ese día predominó la energía.',
    explanation: 'Tu movimiento fue la señal más fuerte.',
  },
  recuperacion: {
    title: 'Ese día predominó la recuperación.',
    explanation: 'Tu descanso fue la señal más fuerte.',
  },
  nutricion: {
    title: 'Ese día predominó la nutrición.',
    explanation: 'Tu alimentación fue la señal más fuerte.',
  },
  equilibrio: {
    title: 'Ese día predominó el equilibrio.',
    explanation: 'Ninguna señal dominó: el día estuvo parejo.',
  },
  exploracion: {
    title: 'Ese día predominó la exploración.',
    explanation: 'Registraste señales más sutiles. Son las que construyen el patrón con el tiempo.',
  },
  presencia: {
    title: 'Ese día predominó la presencia.',
    explanation: 'El registro estuvo presente. Las otras señales, en pausa.',
  },
}

/* ── Evidencia (✓) — sólo lo registrado ──────────────────────────────── */

function buildEvidence(
  s: DailySignals,
  ctx: DayStateCtx,
  driver: SignalKey | null,
): EvidenceItem[] {
  const out: EvidenceItem[] = []
  // Sin "detail" cuando no hay cifra: el verbo ES la evidencia (no relleno).
  if (s.trained === true) out.push({ label: 'Entrenaste', tone: 'energia', signal: 'movimiento' })
  else if (s.rested === true)
    // Toggle binario: sin cifra que mostrar, la claridad va en label + qué alimenta.
    out.push({
      label: 'Día de descanso',
      detail: 'Recuperación',
      tone: 'sueno',
      signal: 'recuperacion',
    })
  if (s.sleep_minutes != null) {
    out.push({
      label: 'Dormiste',
      detail: `${sleepHours(s.sleep_minutes)} horas`,
      tone: 'sueno',
      signal: 'recuperacion',
    })
  }
  // Sólo un déficit SANO es evidencia (nunca celebrar restricción extrema).
  if (healthyDeficit(s, ctx)) {
    out.push({
      label: 'Tu déficit del día',
      detail: `${Math.round(s.calories!)} / ${Math.round(ctx.calorieTarget!)} kcal`,
      tone: 'alimento',
      signal: 'nutricion',
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
      tone: 'proteina',
      signal: 'nutricion',
    })
  }
  if ((s.meal_count ?? 0) > 0) {
    const n = s.meal_count!
    out.push({
      label: 'Registraste tus comidas',
      detail: `${n} ${n === 1 ? 'comida' : 'comidas'}`,
      tone: 'alimento',
      signal: 'nutricion',
    })
  }
  if (s.energy != null || s.mood != null || s.motivation != null || s.stress != null) {
    // El label dice cómo te sentiste; el detalle resume lo demás registrado.
    const w = wellbeingEvidence(s)
    out.push({ label: w.label, detail: w.detail, tone: 'mente', signal: 'bienestar' })
  }
  if ((s.water_glasses ?? 0) > 0) {
    const n = s.water_glasses!
    out.push({
      label: 'Tomaste agua',
      detail: `${n} ${n === 1 ? 'vaso' : 'vasos'}`,
      tone: 'agua',
      signal: 'agua',
    })
  }
  if (s.weight_kg != null) {
    out.push({
      label: 'Registraste tu peso',
      detail: `${s.weight_kg.toFixed(1)} kg`,
      tone: 'leche',
    })
  }
  if (s.on_period === true) out.push({ label: 'Registraste tu ciclo', tone: 'ciclo' })
  // La evidencia de la señal que DECIDIÓ el estado va primero (confirma el titular
  // de arriba); el resto conserva su orden. Sort estable.
  if (driver != null) {
    return [...out].sort((a, b) => Number(b.signal === driver) - Number(a.signal === driver))
  }
  return out
}

/* ── Señales ausentes (○) — ausencia, no error ───────────────────────── */

// SOLO señales DIARIAS: cosas que tiene sentido registrar cada día. El CICLO se
// excluye a propósito — no es diario (menstrúas ~5 días por ciclo), así que pedir
// "registra tu ciclo" todos los días sería presión y, las más, factualmente falso.
// El ciclo se registra como evento en su propio flujo, no como ausencia diaria.
const ABSENT_CANDIDATES: { key: string; label: string; present: (s: DailySignals) => boolean }[] = [
  { key: 'sueno', label: 'Sueño', present: (s) => s.sleep_minutes != null },
  { key: 'comida', label: 'Comida', present: (s) => (s.meal_count ?? 0) > 0 },
  { key: 'agua', label: 'Agua', present: (s) => (s.water_glasses ?? 0) > 0 },
  {
    key: 'animo',
    label: 'Estado de ánimo',
    present: (s) => s.mood != null || s.energy != null || s.motivation != null,
  },
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

/** El estado completo del día (o null si no hubo ningún registro). Puro.
 *  `opts.past` usa la observación en pasado ("Ese día…") al ver un día pasado. */
export function buildDayState(
  s: DailySignals | null,
  ctx: DayStateCtx = {},
  opts: { past?: boolean } = {},
): DayState | null {
  if (s == null) return null
  const key = selectDayStateKey(s, ctx)
  if (key == null) return null
  const copy = opts.past ? STATE_COPY_PAST[key] : STATE_COPY[key]
  return {
    key,
    title: copy.title,
    explanation: copy.explanation,
    driver: STATE_DRIVER[key],
    strengths: signalStrengths(s, ctx).sort((a, b) => b.stars - a.stars),
    evidence: buildEvidence(s, ctx, STATE_DRIVER[key]),
    absent: buildAbsent(s),
    closing: closingFor(s.day),
  }
}
