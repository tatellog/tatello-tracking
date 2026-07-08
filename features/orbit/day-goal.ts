/*
 * Órbita · Día — "¿Cómo voy hoy?" (Stelar v2, SIN IA).
 *
 * Fuente de verdad: docs/orbita-dia-redesign-spec.md. Reemplaza el modelo v1 de
 * 7 estados (day-state.ts). Órbita Día responde UNA pregunta: ¿me acerco a mi
 * objetivo hoy? El héroe es el estado del déficit; debajo, la evidencia que YA
 * apareció, lo que aún falta, y hacia dónde apunta el día con su porqué.
 *
 * Todo determinístico: solo afirma lo que está en daily_signals. No predice, no
 * aconseja, no juzga. Nunca inventa una conclusión. Lógica pura y testeable; la
 * capa visual la consume en DayPresent.tsx.
 */
import type { DailySignals } from './api'
import { isDeficitDay } from './deficit'

/** Tono de cada evidencia = el color de SU dimensión (la capa visual lo resuelve
 *  a hex). Hace de la evidencia un cielo multicolor, no una lista monocroma. */
export type GoalTone =
  | 'cuerpo'
  | 'sueno'
  | 'alimento'
  | 'ciclo'
  | 'energia'
  | 'mente'
  | 'proteina'
  | 'agua'
  | 'leche'

/** El estado del objetivo del día — lo que decide el héroe. */
export type GoalStatus = 'deficit' | 'over' | 'incomplete'

export type GoalHero = {
  status: GoalStatus
  /** kcal para el número grande: lo que falta para la meta (déficit) o lo que la
   *  excede (over). null cuando no hay comida/meta que juzgar. */
  deltaKcal: number | null
  consumed: number | null
  target: number | null
  /** Llenado del anillo 0..1 (consumo / meta, tope 1). */
  fill: number
  /** Excedente sobre la meta 0..~ → el arco oro (solo over). */
  over: number
  /** Anillo de proteína 0..1 (g / meta, tope 1); null si no hay meta o dato. */
  proteinFill: number | null
  /** Proteína del día en gramos (para la leyenda); null si no hay dato. */
  proteinG: number | null
  /** Anillo de entreno (binario): entrenó hoy o no. */
  trained: boolean
  /** kcal del entreno detectadas por el wearable (suma del día). null si el
   *  entreno fue manual o no hubo — nunca 0 como deuda. SOLO display: jamás
   *  toca el target de calorías ni el TDEE (spec wearables §3). */
  workoutKcal: number | null
  /** Procedencia del entreno: 'manual' | 'wearable' | null. La leyenda
   *  muestra la kcal + "tu reloj" solo cuando es wearable. */
  workoutSource: string | null
  /** "Vas en déficit" / "Sobre tu objetivo" / "Tu día aún se revela". */
  stateLabel: string
  /** Línea de apoyo bajo el anillo. Informa, nunca culpa ni celebra. */
  line: string
}

export type GoalEvidence = { key: string; label: string; detail?: string; tone: GoalTone }
export type GoalMissing = { key: string; label: string }
/** Una pieza del "¿Por qué?": `supports` true empuja hacia "dentro del objetivo",
 *  false es lo que va en contra (déficit perdido). Honesto en ambos sentidos. */
export type GoalWhy = { key: string; label: string; tone: GoalTone; supports: boolean }

export type DayGoal = {
  hero: GoalHero
  /** ✓ lo que YA apareció hoy, con su dato real. */
  evidence: GoalEvidence[]
  /** ○ señales diarias que aún no aparecen (ausencia, no error). */
  missing: GoalMissing[]
  /** La trayectoria de hoy en una frase. Sin predicción. */
  direction: string
  /** La evidencia que sostiene (o contradice) la dirección. */
  why: GoalWhy[]
  /** Frase de cierre que conecta con Órbita Semana. */
  closing: string
}

export type DayGoalCtx = {
  proteinTarget?: number | null
  calorieTarget?: number | null
  waterGoalGlasses?: number
}

const sleepHours = (min: number): number => Math.round((min / 60) * 10) / 10
const qualWord = (n: number): string => (n >= 4 ? 'alta' : n === 3 ? 'media' : 'baja')
const moodWord = (m: string): string =>
  m === 'good' ? 'bien' : m === 'neutral' ? 'neutral' : 'en lucha'

/** ¿Hubo algún registro hoy? Sin nada, el día no habla todavía (la UI muestra la
 *  invitación de vacío). */
export function hasAnySignal(s: DailySignals): boolean {
  return (
    s.sleep_minutes != null ||
    s.energy != null ||
    s.mood != null ||
    s.stress != null ||
    s.motivation != null ||
    s.meal_count != null ||
    s.calories != null ||
    s.protein_g != null ||
    s.trained === true ||
    s.rested === true ||
    s.on_period === true ||
    (s.water_glasses ?? 0) > 0 ||
    s.weight_kg != null
  )
}

const proteinReached = (s: DailySignals, ctx: DayGoalCtx): boolean =>
  ctx.proteinTarget != null &&
  ctx.proteinTarget > 0 &&
  s.protein_g != null &&
  s.protein_g >= ctx.proteinTarget

/* ── Héroe — el estado del déficit del día ───────────────────────────── */

function buildHero(s: DailySignals, ctx: DayGoalCtx, past: boolean): GoalHero {
  const target =
    ctx.calorieTarget != null && ctx.calorieTarget > 0 ? Math.round(ctx.calorieTarget) : null
  const consumed = s.calories != null && s.calories > 0 ? Math.round(s.calories) : null

  // Anillos de acompañamiento (proteína / entreno), independientes del de
  // calorías: siempre presentes en el hero para los anillos concéntricos.
  const proteinFill =
    ctx.proteinTarget != null && ctx.proteinTarget > 0 && s.protein_g != null
      ? Math.min(1, s.protein_g / ctx.proteinTarget)
      : null
  const proteinG = s.protein_g != null ? Math.round(s.protein_g) : null
  const trained = s.trained === true
  // La kcal del reloj solo acompaña a un día ENTRENADO; si el dato quedó
  // huérfano (kcal sin trained, imposible por la view pero defensivo), se
  // descarta para que la leyenda nunca hable de un entreno que no existe.
  const workoutKcal = trained && s.workout_kcal != null ? Math.round(s.workout_kcal) : null
  const workoutSource = trained ? (s.workout_source ?? null) : null

  // Sin comida o sin meta → no hay objetivo que juzgar. El día aún se revela.
  // stateLabel = la PALABRA-titular (héroe "Hoy estás en [Déficit]"); el matiz de
  // pasado lo dan el encabezado (fecha) + la línea, no la palabra.
  if (target == null || consumed == null) {
    return {
      status: 'incomplete',
      deltaKcal: null,
      consumed,
      target,
      fill: 0,
      over: 0,
      proteinFill,
      proteinG,
      trained,
      workoutKcal,
      workoutSource,
      stateLabel: 'Tu día aún se revela',
      line: past
        ? 'Ese día no quedó registro de comida.'
        : 'Cuando registres tu comida, verás cómo va tu objetivo.',
    }
  }

  if (consumed <= target) {
    return {
      status: 'deficit',
      // Magnitud del déficit (meta − consumido); la UI le antepone "−".
      deltaKcal: target - consumed,
      consumed,
      target,
      fill: Math.min(1, consumed / target),
      over: 0,
      proteinFill,
      proteinG,
      trained,
      workoutKcal,
      workoutSource,
      stateLabel: 'Déficit',
      line: past
        ? 'Ese día cerró con margen bajo tu meta.'
        : 'Aún tienes margen para cerrar el día.',
    }
  }

  return {
    status: 'over',
    deltaKcal: consumed - target,
    consumed,
    target,
    fill: 1,
    over: Math.min(0.45, (consumed - target) / target),
    proteinFill,
    proteinG,
    trained,
    workoutKcal,
    workoutSource,
    stateLabel: 'Sobre tu objetivo',
    line: past ? 'Ese día quedó sobre tu objetivo.' : 'Tu ritmo continúa mañana.',
  }
}

/* ── La evidencia (✓) — solo lo que YA apareció hoy, con su dato real ─── */

// Una frase humana y corta del bienestar. Sin "calma alta/baja" (deriva de
// 6 - stress, suena a medición clínica); el ánimo lidera y la energía es un
// detalle de una palabra. Voz cálida, no boleta.
function wellbeingEvidence(s: DailySignals): { label: string; detail?: string } {
  const energyDetail = s.energy != null ? `Energía ${qualWord(s.energy)}` : undefined
  if (s.mood != null) return { label: `Te sentiste ${moodWord(s.mood)}`, detail: energyDetail }
  if (s.energy != null) return { label: `Energía ${qualWord(s.energy)}` }
  return { label: 'Registraste cómo te sentiste' }
}

function buildEvidence(s: DailySignals, ctx: DayGoalCtx): GoalEvidence[] {
  const out: GoalEvidence[] = []

  // El déficit NO va en la evidencia: ya es el héroe (anillo + número). Repetirlo
  // gastaría el primer renglón en lo que la usuaria acaba de ver (UX audit).

  // Proteína — la métrica más cuidada (recomposición). En objetivo o en progreso.
  if (ctx.proteinTarget != null && ctx.proteinTarget > 0 && s.protein_g != null) {
    const p = Math.round(s.protein_g)
    out.push({
      key: 'protein',
      label: p >= ctx.proteinTarget ? 'Proteína en objetivo' : 'Proteína',
      detail: `${p} / ${Math.round(ctx.proteinTarget)} g`,
      tone: 'proteina',
    })
  }

  if (s.trained === true) {
    // La kcal del reloj como DATO de la evidencia (igual que proteína o
    // sueño llevan el suyo). Solo con wearable; el entreno manual no tiene
    // kcal y no se le inventa. El "~" dice honesto: es estimación del reloj.
    const kcal = s.workout_kcal != null ? `~${Math.round(s.workout_kcal)} kcal` : undefined
    out.push({ key: 'train', label: 'Entrenaste', detail: kcal, tone: 'cuerpo' })
  } else if (s.rested === true) {
    out.push({ key: 'rest', label: 'Día de descanso', tone: 'sueno' })
  }

  // El conteo de comidas NO es evidencia (Regla #1: nunca contar registros como
  // logro). La nutrición ya la cuenta la proteína + el héroe del déficit.

  if (s.sleep_minutes != null) {
    out.push({
      key: 'sleep',
      label: 'Dormiste',
      detail: `${sleepHours(s.sleep_minutes)} h`,
      tone: 'sueno',
    })
  }

  if ((s.water_glasses ?? 0) > 0) {
    const g = s.water_glasses!
    const goal = Math.max(1, ctx.waterGoalGlasses ?? 8)
    out.push({
      key: 'water',
      label: g >= goal ? 'Agua completa' : 'Agua',
      detail: `${g} / ${goal} vasos`,
      tone: 'agua',
    })
  }

  if (s.energy != null || s.mood != null || s.motivation != null || s.stress != null) {
    const w = wellbeingEvidence(s)
    out.push({ key: 'wellbeing', label: w.label, detail: w.detail, tone: 'mente' })
  }

  if (s.weight_kg != null) {
    out.push({
      key: 'weight',
      label: 'Registraste tu peso',
      detail: `${s.weight_kg.toFixed(1)} kg`,
      tone: 'leche',
    })
  }

  if (s.on_period === true) out.push({ key: 'cycle', label: 'Registraste tu ciclo', tone: 'ciclo' })

  return out
}

/* ── Lo que aún no aparece (○) — solo señales DIARIAS (ciclo excluido) ── */

const MISSING_CANDIDATES: {
  key: string
  label: string
  present: (s: DailySignals) => boolean
}[] = [
  { key: 'sueno', label: 'Sueño', present: (s) => s.sleep_minutes != null },
  { key: 'comida', label: 'Comida', present: (s) => (s.meal_count ?? 0) > 0 },
  { key: 'agua', label: 'Agua', present: (s) => (s.water_glasses ?? 0) > 0 },
  {
    key: 'animo',
    label: 'Ánimo',
    present: (s) => s.mood != null || s.energy != null || s.motivation != null,
  },
]

function buildMissing(s: DailySignals): GoalMissing[] {
  return MISSING_CANDIDATES.filter((c) => !c.present(s)).map((c) => ({
    key: c.key,
    label: c.label,
  }))
}

/** Hero "en reposo" para el empty state de Órbita Día: los anillos existen pero
 *  en calma (status incomplete, fill 0) → "aquí va a nacer tu día", nunca "esto
 *  no hiciste". Reusa la gramática del track-en-reposo de GoalRing. */
export const REST_HERO: GoalHero = {
  status: 'incomplete',
  deltaKcal: null,
  consumed: null,
  target: null,
  fill: 0,
  over: 0,
  proteinFill: null,
  proteinG: null,
  trained: false,
  workoutKcal: null,
  workoutSource: null,
  stateLabel: '',
  line: '',
}

/** Todas las señales diarias como AUSENTES (nada registrado) → los chips de
 *  registro del empty state, para que haya algo tocable (no un callejón sin salida). */
export function restDayMissing(): GoalMissing[] {
  return MISSING_CANDIDATES.map((c) => ({ key: c.key, label: c.label }))
}

/* ── Dirección — la trayectoria de hoy en una frase ──────────────────── */

function buildDirection(hero: GoalHero, s: DailySignals, ctx: DayGoalCtx, past: boolean): string {
  const when = past ? 'la evidencia de ese día' : 'La evidencia de hoy'
  const cap = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

  if (hero.status === 'incomplete') {
    return past
      ? `${cap(when)} quedó incompleta.`
      : `${when} aún está incompleta. Conforme avance el día, habrá más.`
  }
  if (hero.status === 'over') {
    return `${past ? cap(when) : when} muestra que ${past ? 'estuviste' : 'estás'} sobre tu objetivo.`
  }
  // deficit. Solo un déficit SANO (dentro de [0.6×meta, meta]) se lee como
  // "dentro del objetivo": comer muy por debajo del piso NO se valida (línea
  // roja del manifiesto · restricción extrema). Por debajo, lectura neutral.
  if (!isDeficitDay(s.calories, ctx.calorieTarget)) {
    return `${past ? cap(when) : when} todavía está tomando forma.`
  }
  if (proteinReached(s, ctx) || s.trained === true) {
    return `${past ? cap(when) : when} se parece a tus días dentro del objetivo.`
  }
  return `${past ? cap(when) : when} apunta a un día dentro de tu objetivo.`
}

/* ── Por qué — la evidencia que sostiene (o contradice) la dirección ──── */

function buildWhy(hero: GoalHero, s: DailySignals, ctx: DayGoalCtx): GoalWhy[] {
  const out: GoalWhy[] = []
  if (hero.status === 'incomplete') return out

  if (hero.status === 'over') {
    out.push({
      key: 'over',
      label: 'Calorías sobre tu objetivo',
      tone: 'alimento',
      supports: false,
    })
  } else if (isDeficitDay(s.calories, ctx.calorieTarget)) {
    // Solo un déficit SANO se afirma como logro; bajo el piso no se valida.
    out.push({ key: 'deficit', label: 'Déficit de calorías', tone: 'alimento', supports: true })
  }
  if (proteinReached(s, ctx)) {
    out.push({ key: 'protein', label: 'Proteína en objetivo', tone: 'proteina', supports: true })
  }
  if (s.trained === true) {
    out.push({ key: 'train', label: 'Entrenamiento', tone: 'cuerpo', supports: true })
  }
  return out
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

/** El día completo orientado al objetivo (o null si no hubo ningún registro).
 *  Puro. `opts.past` usa la observación en pasado al ver un día pasado. */
export function buildDayGoal(
  s: DailySignals | null,
  ctx: DayGoalCtx = {},
  opts: { past?: boolean } = {},
): DayGoal | null {
  if (s == null || !hasAnySignal(s)) return null
  const past = opts.past ?? false
  const hero = buildHero(s, ctx, past)
  return {
    hero,
    evidence: buildEvidence(s, ctx),
    missing: buildMissing(s),
    direction: buildDirection(hero, s, ctx, past),
    why: buildWhy(hero, s, ctx),
    closing: closingFor(s.day),
  }
}
