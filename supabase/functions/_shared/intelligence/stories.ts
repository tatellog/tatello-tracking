/*
 * Story Engine (R1 · Engine 3) — encadena MÚLTIPLES findings en una HISTORIA.
 * Puro, determinístico, compartido (app + Edge Functions).
 *
 * Una historia = dos hallazgos de DIMENSIONES distintas que COINCIDIERON en días
 * reales (≥2 días compartidos). NUNCA afirma causa (línea roja del manifiesto):
 * solo nota que los dos ejes aparecieron juntos. `chain` son los NODOS (labels);
 * el marco tentativo ("no sé si va junto, pero…") lo pone el render (F5), no el
 * motor. El score rankea por fuerza de la coincidencia + confianza.
 *
 * Ref: docs/epics/epic-01-intelligence-engine.md (T3.2). Contrato: engine.ts.
 */
import type { Finding, Story } from './engine.ts'

/** Días que dos hallazgos comparten en su evidencia. */
function sharedDays(a: Finding, b: Finding): number {
  const setB = new Set(b.evidenceDates)
  return a.evidenceDates.filter((d) => setB.has(d)).length
}

/**
 * Historias del mes: pares de hallazgos de dimensiones distintas que coinciden
 * en ≥2 días. Determinístico y tentativo (co-ocurrencia, no causa). Cap 3, por
 * score (días compartidos + la confianza más baja del par).
 */
export function buildStories(findings: readonly Finding[]): Story[] {
  const stories: Story[] = []
  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const a = findings[i]!
      const b = findings[j]!
      // Una historia cruza DIMENSIONES; dos hallazgos del mismo eje no lo son.
      if (a.category === b.category) continue
      const shared = sharedDays(a, b)
      if (shared < 2) continue // muestra real de coincidencia

      // Si ambos acercan al norte (déficit), el nodo final es el déficit.
      const bothNorth = !!a.northLink && !!b.northLink
      const chain = bothNorth ? [a.subject, b.subject, 'tu déficit'] : [a.subject, b.subject]

      stories.push({
        id: `${a.id}+${b.id}`,
        findingIds: [a.id, b.id],
        chain,
        score: shared * 5 + Math.min(a.confidence, b.confidence),
      })
    }
  }
  return stories.sort((x, y) => y.score - x.score).slice(0, 3)
}
