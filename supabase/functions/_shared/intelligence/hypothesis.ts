/*
 * Hypothesis Engine (R1 · Engine 5) — genera HIPÓTESIS que SUGIEREN, no afirman.
 * Puro, determinístico, compartido (app + Edge Functions).
 *
 * Una hipótesis nota una posible RELACIÓN ("es posible que…"), NUNCA una causa
 * (línea roja del manifiesto) ni una receta. Dos fuentes:
 *   · una HISTORIA (par de findings que coincidieron) → "es posible que A y B
 *     vayan de la mano".
 *   · el CRUCE de un finding (otra dimensión que coincidió pero NO es un finding,
 *     ej. sueño) → reusa el texto tentativo ya detectado (crossHypothesis).
 *
 * `status: 'open'` es la semilla del ciclo de Experiments (R5). Ref: engine.ts,
 * docs/epics/epic-01-intelligence-engine.md (T4.2).
 */
import type { Finding, Hypothesis, Story } from './engine.ts'

/**
 * Hipótesis del mes (tentativas, status 'open'). Cap 3, por confianza. Vacío si
 * no hay historias ni cruces (no se inventa una relación sin coincidencia real).
 */
export function buildHypotheses(
  findings: readonly Finding[],
  stories: readonly Story[],
): Hypothesis[] {
  const byId = new Map(findings.map((f) => [f.id, f]))
  const hyps: Hypothesis[] = []

  // De cada historia: la relación entre las dos dimensiones que coincidieron.
  for (const s of stories) {
    const fa = byId.get(s.findingIds[0]!)
    const fb = byId.get(s.findingIds[1]!)
    if (!fa || !fb) continue
    hyps.push({
      id: `hyp-story-${s.id}`,
      text: `Es posible que ${fa.subject} y ${fb.subject} vayan de la mano en tu mes.`,
      confidence: Math.min(fa.confidence, fb.confidence),
      status: 'open',
      sourceStoryId: s.id,
    })
  }

  // De cada finding con un cruce ya detectado (dimensión que no es finding).
  for (const f of findings) {
    if (!f.hypothesis) continue
    hyps.push({
      id: `hyp-find-${f.id}`,
      text: f.hypothesis, // ya tentativo ("no sé si va junto, pero ahí están los dos")
      confidence: f.confidence,
      status: 'open',
      sourceFindingId: f.id,
    })
  }

  return hyps.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
}
