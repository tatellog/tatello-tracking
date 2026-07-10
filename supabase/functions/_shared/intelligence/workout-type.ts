/*
 * Workout-type intelligence — el pago del dato que la usuaria anota en los
 * chips del check-in de Hoy (workouts.type → daily_signals.workout_type).
 * Dos lecturas, ambas con guardas de honestidad:
 *
 *   · workoutTypeMix     → la mezcla real de movimiento ("4 de fuerza ·
 *                          2 de caminata"). Es ECO de registro, no patrón:
 *                          vive como evidencia dentro de la constancia de
 *                          Movimiento, nunca como tarjeta suelta (la regla
 *                          anti-conteo-decorativo de Mes).
 *   · workoutTypeDeficitSplit → el tipo de entreno que MÁS acompaña el
 *                          déficit (el norte), comparado contra el resto de
 *                          los entrenos. Co-ocurrencia, NO causa.
 *
 * Puro y compartido (app + Edge Functions): sin React Native, sin Supabase,
 * sin Deno globals. La regla de "día en déficit" vive en el cliente
 * (features/orbit/deficit.ts, fuente única); aquí se INYECTA como predicado
 * para no duplicarla.
 */
import type { DailySignals } from './types.ts'

/** Etiquetas canónicas de workouts.type (los ids de los chips de Hoy). Un
 *  tipo fuera del catálogo cae a su propio texto capitalizado. */
const TYPE_LABELS: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  caminata: 'Caminata',
  otro: 'Otro',
}

export function workoutTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

export type WorkoutTypeMix = {
  /** Días de entreno CON tipo anotado en la ventana. */
  typedDays: number
  /** Conteo por tipo, mayor primero (empates por alfabeto → estable). */
  counts: { type: string; label: string; days: number }[]
}

/** Mínimo de entrenos tipados antes de nombrar la mezcla — un solo dato no
 *  es una mezcla. */
const MIX_MIN_TYPED = 2

/** La distribución de tipos de entreno de la ventana, o null si aún no hay
 *  suficientes entrenos tipados para decir algo. */
export function workoutTypeMix(history: readonly DailySignals[]): WorkoutTypeMix | null {
  const byType = new Map<string, number>()
  for (const s of history) {
    if (s.trained !== true || !s.workout_type) continue
    byType.set(s.workout_type, (byType.get(s.workout_type) ?? 0) + 1)
  }
  const typedDays = [...byType.values()].reduce((a, b) => a + b, 0)
  if (typedDays < MIX_MIN_TYPED) return null
  const counts = [...byType.entries()]
    .map(([type, days]) => ({ type, label: workoutTypeLabel(type), days }))
    .sort((a, b) => b.days - a.days || a.label.localeCompare(b.label))
  return { typedDays, counts }
}

/** "4 de fuerza · 2 de caminata" — el eco literal de lo que anotó. */
export function workoutTypeMixPhrase(mix: WorkoutTypeMix): string {
  return mix.counts.map((c) => `${c.days} de ${c.label.toLowerCase()}`).join(' · ')
}

export type WorkoutTypeDeficitSplit = {
  /** El tipo con mejor tasa de déficit (id + etiqueta). */
  type: string
  label: string
  bestDeficit: number
  bestTotal: number
  /** El resto de los entrenos (otros tipos + entrenos sin tipo). */
  otherDeficit: number
  otherTotal: number
}

/* Mismas guardas que los patrones B3/B5 de Mes: muestra mínima por lado y
 * efecto marcado (brecha absoluta Y relativa) — no convertimos ruido en
 * "patrón". */
const PAIR_MIN = 3
const RATE_GAP = 0.2
const RATE_RATIO = 1.3

/**
 * El tipo de entreno que más co-ocurre con el déficit, comparado contra el
 * RESTO de los entrenos (otros tipos y entrenos sin tipo), o null cuando los
 * datos no lo sostienen. `history` deben ser días CON comida registrada (el
 * denominador honesto de Mes); `isDeficit` es la regla única del cliente.
 */
export function workoutTypeDeficitSplit(
  history: readonly DailySignals[],
  target: number,
  isDeficit: (calories: number | null | undefined, target: number) => boolean,
): WorkoutTypeDeficitSplit | null {
  const trainedDays = history.filter((s) => s.trained === true)
  const byType = new Map<string, DailySignals[]>()
  for (const s of trainedDays) {
    if (!s.workout_type) continue
    const arr = byType.get(s.workout_type) ?? []
    arr.push(s)
    byType.set(s.workout_type, arr)
  }

  let best: { type: string; def: number; total: number; rate: number } | null = null
  for (const [type, days] of byType) {
    if (days.length < PAIR_MIN) continue
    const def = days.filter((s) => isDeficit(s.calories, target)).length
    const rate = def / days.length
    if (!best || rate > best.rate) best = { type, def, total: days.length, rate }
  }
  if (!best) return null

  const bestType = best.type
  const others = trainedDays.filter((s) => s.workout_type !== bestType)
  if (others.length < PAIR_MIN) return null
  const otherDef = others.filter((s) => isDeficit(s.calories, target)).length
  const otherRate = otherDef / others.length

  if (best.rate < otherRate * RATE_RATIO || best.rate - otherRate < RATE_GAP) return null

  return {
    type: bestType,
    label: workoutTypeLabel(bestType),
    bestDeficit: best.def,
    bestTotal: best.total,
    otherDeficit: otherDef,
    otherTotal: others.length,
  }
}
