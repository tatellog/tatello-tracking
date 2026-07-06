/*
 * La lectura garantizada — micro-observaciones deterministas que funcionan
 * desde n≈2 días de datos. Regla de producto (mvp-improvement-plan Fase 6):
 * la respuesta a la pregunta del tab NUNCA es "nada todavía"; es "esto es
 * lo poco que ya se ve". Es el puente de las semanas 1-3, antes de que los
 * patrones reales (3-4 semanas) empiecen a pagar.
 *
 * Reglas duras (manifiesto + benchmark):
 *   · Solo datos reales de la usuaria. Sin nada honesto que decir → null
 *     (la promesa honesta del caller se queda; jamás relleno-horóscopo).
 *   · Tono neutro o a favor. NUNCA comparación en clave de caída
 *     ("hoy menos que ayer" ✗). La ausencia simplemente calla.
 *   · Determinista, sin IA. Corre en backend y cliente (re-export).
 */
import type { DailySignals } from './types'

export type EarlyReading = {
  /** Observación corta, en UI upright (dato), no voz de coach. */
  text: string
}

/** Presencia de cada señal en un día (mismo criterio que las dimensiones). */
const PRESENT: Record<string, (s: DailySignals) => boolean> = {
  comida: (s) => (s.meal_count ?? 0) > 0,
  sueño: (s) => (s.sleep_minutes ?? 0) > 0,
  entreno: (s) => s.trained === true,
  agua: (s) => (s.water_glasses ?? 0) > 0,
  ánimo: (s) => s.mood != null,
}

/** Orden de relevancia para elegir UNA señal cuando varias califican
 *  (comida primero: es el norte del producto). */
const SIGNAL_ORDER = ['comida', 'sueño', 'entreno', 'agua', 'ánimo'] as const

/** La coda puente ayer→hoy. Rota por fecha (determinista, sin Math.random)
 *  para no volverse plantilla al verse varios días seguidos (voice-and-copy). */
const CODAS = [
  'Hoy sigue desde ahí.',
  'Hoy continúa esa misma línea.',
  'Hoy es otro punto en esa misma dirección.',
] as const

function codaFor(today: string): string {
  return CODAS[Number(today.slice(8, 10)) % CODAS.length]!
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * La micro-lectura de un día aún vacío: qué se ve YA en los días previos.
 * `history` = filas de daily_signals (cualquier orden); `today` = el día
 * vacío que se está mirando. `null` si no hay nada honesto que observar.
 */
export function earlyReading(history: readonly DailySignals[], today: string): EarlyReading | null {
  const byDay = new Map<string, DailySignals>()
  for (const s of history) if (s.day != null) byDay.set(s.day, s)

  const yesterday = byDay.get(shiftDate(today, -1))
  const dayBefore = byDay.get(shiftDate(today, -2))

  // 1 · Repetición naciente: una señal presente AYER y ANTIER — el germen de
  //     un patrón. SIN contar días consecutivos ("dos días seguidos" es el
  //     mismo mecanismo de racha que el manifiesto prohíbe sembrar; la
  //     frecuencia se SIENTE, no se cuenta — voice-and-copy).
  if (yesterday && dayBefore) {
    for (const key of SIGNAL_ORDER) {
      if (PRESENT[key]!(yesterday) && PRESENT[key]!(dayBefore)) {
        return { text: `Tu ${key} está apareciendo seguido. Eso ya es una señal.` }
      }
    }
  }

  // 2 · Ayer dejó huella (neutro, sin juicio). "cosas", no "señales": ese
  //     término choca con "Señal Naciente" del glosario V2.
  if (yesterday) {
    const present = SIGNAL_ORDER.filter((k) => PRESENT[k]!(yesterday))
    if (present.length >= 2) {
      return { text: `Ayer registraste varias cosas. ${codaFor(today)}` }
    }
    if (present.length === 1) {
      return { text: `Ayer registraste tu ${present[0]!}. ${codaFor(today)}` }
    }
  }

  return null
}
