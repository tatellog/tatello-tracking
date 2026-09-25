/*
 * Pasos · ritmo semanal (spec wearables §9 · decisión dueña sep 2026).
 *
 * Los pasos llegan del reloj (ingest-only hasta hoy) y su ÚNICA superficie es
 * Órbita Semana: un ritmo por día de la semana + el promedio como evidencia.
 * Sin meta (nada de 10,000), sin contador diario, sin juicio. Vive en el motor
 * compartido (app + Edge Functions) como cualquier lectura determinística.
 */
import type { DailySignals } from './types.ts'

export type StepsRhythm = {
  /** Promedio de pasos por día con dato, redondeado a centenas. */
  avgSteps: number
  /** Días de la semana (lunes→hoy) con pasos > 0. */
  daysWithData: number
  /** Nombres de los días que destacan sobre el promedio (máx. 2), en orden. */
  topDays: string[]
}

const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Mínimo de días con pasos para hablar (Stelar no infiere sin evidencia). */
export const STEPS_MIN_DAYS = 3
/** Un día destaca si supera el promedio por este factor. */
export const STEPS_TOP_FACTOR = 1.2

/** Lunes=0 … Domingo=6 de un ISO 'YYYY-MM-DD' (UTC, independiente del device). */
function mondayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
}

/**
 * Ritmo de pasos de la semana en curso a partir de las filas de daily_signals
 * (cualquier rango; se filtra a lunes→hoy). Null cuando no hay evidencia
 * suficiente: la superficie calla, nunca rellena.
 */
export function stepsRhythm(
  signals: readonly Pick<DailySignals, 'day' | 'steps'>[],
  mondayIso: string,
  todayIso: string,
): StepsRhythm | null {
  const days = signals.filter(
    (s): s is { day: string; steps: number } =>
      s.day != null &&
      s.day >= mondayIso &&
      s.day <= todayIso &&
      typeof s.steps === 'number' &&
      s.steps > 0,
  )
  if (days.length < STEPS_MIN_DAYS) return null

  const total = days.reduce((acc, d) => acc + d.steps, 0)
  const avg = total / days.length
  const topDays = [...days]
    .filter((d) => d.steps >= avg * STEPS_TOP_FACTOR)
    .sort((a, b) => b.steps - a.steps)
    .slice(0, 2)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => WEEKDAYS[mondayIndex(d.day)]!)

  return {
    avgSteps: Math.round(avg / 100) * 100,
    daysWithData: days.length,
    topDays,
  }
}
