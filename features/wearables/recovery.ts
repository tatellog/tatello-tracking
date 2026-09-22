/*
 * Smart Recovery (V-15) — lógica pura.
 *
 * "Si el reloj ya dijo entrenaste o dormiste, Stelar no pregunta." Este módulo
 * responde UNA pregunta a partir de la fila de daily_signals del día: ¿qué
 * dimensiones llegaron SOLAS desde el wearable (sin registro manual)? Hoy, el
 * pager de rituales y Órbita Día lo usan para sellar en vez de preguntar.
 *
 * Reglas:
 *   · Prioridad al dato del dispositivo, el manual complementa (roadmap V-15).
 *     Un registro manual de la misma dimensión gana en la view; aquí solo se
 *     reporta lo que vino del reloj y no tiene manual encima.
 *   · Robusto a la view vieja: `sleep_source` / `workout_minutes` llegaron en
 *     la migración 20260922120000. Si la columna aún no existe, el sueño del
 *     reloj se infiere por ausencia de registro manual (`manualSleepMinutes`).
 *   · Sin side effects: todo se deriva de la fila + el manual del día.
 */
import type { DailySignals } from '@/features/orbit/api'

export type WearableWorkoutFacts = {
  /** Estimación del reloj; null si no la trajo (nunca 0 como deuda). */
  kcal: number | null
  minutes: number | null
  /** fuerza / cardio / caminata / otro (normalizado en logic.ts). */
  type: string | null
}

export type WearableSleepFacts = {
  minutes: number
}

export type WearableDayFacts = {
  /** Entreno que llegó del reloj y NO tiene registro manual encima. */
  workout: WearableWorkoutFacts | null
  /** Noche que llegó del reloj y NO tiene registro manual encima. */
  sleep: WearableSleepFacts | null
}

export const NO_WEARABLE_FACTS: WearableDayFacts = { workout: null, sleep: null }

type Opts = {
  /** Minutos del registro MANUAL de sueño del día (sleep_logs), si existe.
   *  Permite inferir la procedencia cuando la view aún no trae sleep_source. */
  manualSleepMinutes?: number | null
}

/**
 * Qué llegó del reloj hoy sin registro manual. `signals` puede ser la fila
 * de la view o null/undefined (sin datos / cargando) → nada del reloj.
 */
export function wearableDayFacts(
  signals: DailySignals | null | undefined,
  opts: Opts = {},
): WearableDayFacts {
  if (!signals) return NO_WEARABLE_FACTS

  const workout: WearableWorkoutFacts | null =
    signals.trained === true && signals.workout_source === 'wearable'
      ? {
          kcal: positiveOrNull(signals.workout_kcal),
          minutes: positiveOrNull(signals.workout_minutes),
          type: signals.workout_type ?? null,
        }
      : null

  const sleepMinutes = positiveOrNull(signals.sleep_minutes)
  const sleepSource = signals.sleep_source
  const sleepFromWearable =
    sleepMinutes != null &&
    (sleepSource === 'wearable' ||
      // View sin la columna todavía: si no hay manual y la view trae sueño,
      // solo pudo venir del reloj (la view solo lee sleep_logs y wearable_sleep).
      (sleepSource == null && opts.manualSleepMinutes == null))

  return {
    workout,
    sleep: sleepFromWearable ? { minutes: sleepMinutes } : null,
  }
}

function positiveOrNull(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * La línea de procedencia del entreno sellado por el reloj:
 * "desde tu reloj · 45 min · ~342 kcal". Solo dice lo que el reloj trajo.
 */
export function workoutProvenanceLine(w: WearableWorkoutFacts): string {
  const parts = ['desde tu reloj']
  if (w.minutes != null) parts.push(`${w.minutes} min`)
  if (w.kcal != null) parts.push(`~${w.kcal} kcal`)
  return parts.join(' · ')
}
