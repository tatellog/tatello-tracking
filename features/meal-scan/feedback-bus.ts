/*
 * Bus del loop "¿le atiné?" (M1 · scan excepcional).
 *
 * Al guardar una comida NACIDA de un scan (foto/texto), el confirm emite
 * aquí y el toast global (ScanFeedbackToast, montado en el tabs layout)
 * pregunta si la lectura fue buena. El "Sí" y el "Ajustar" alimentan
 * analytics (scan_feedback) — la medida real de la calidad del scan, la
 * métrica de M1 — y "Ajustar" reabre la comida al instante. Mismo patrón
 * que undo-meal-bus: el sheet/pantalla muere antes de que el toast viva.
 */

import type { ScanConfidence } from './scan'

export type ScanFeedbackPayload = {
  /** id del meal recién creado (para reabrirlo con Ajustar). */
  id: string
  name: string
  /** Confianza que declaró el modelo — viaja al evento de analytics. */
  confidence: ScanConfidence
}

type Listener = (payload: ScanFeedbackPayload) => void

const listeners = new Set<Listener>()

export function emitScanFeedback(payload: ScanFeedbackPayload): void {
  listeners.forEach((fn) => fn(payload))
}

export function subscribeScanFeedback(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
