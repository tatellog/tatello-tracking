/*
 * Memoria de patrones — la POLÍTICA pura de qué se archiva (sin side effects, sin
 * supabase · testeable). El writer con I/O vive en pattern-memory.ts.
 * Spec: docs/orbita-pattern-memory-spec.md.
 */
import type { Finding } from './findings'

/** Los kinds de patrón archivables (deben existir en el CHECK de revelations). */
export type PatternKind = 'rescue' | 'rising_signal'

/**
 * Mapea un hallazgo a su kind archivable, o null si NO se archiva. Solo lo que
 * POTENCIA: el rescate (Ancla) y las señales nacientes (emerging = Señal
 * Naciente). Los obstáculos y el veredicto de déficit NO se archivan (un marcador
 * de "día malo" roza la culpa · manifiesto; el veredicto no es un descubrimiento).
 */
export function patternKindFor(f: Finding): PatternKind | null {
  if (f.isObstacle) return null
  if (f.id === 'deficit-summary') return null
  if (f.id === 'rescue') return 'rescue'
  if (f.emerging) return 'rising_signal'
  return null
}
