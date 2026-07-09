/*
 * Monthly Report (R1 · integrador final) — ENSAMBLA el reporte del mes. Puro,
 * determinístico, compartido (app + Edge Functions). No detecta ni interpreta:
 * orquesta los engines ya construidos en el orden del pipeline R1
 * (Findings → Ranking → Story → Hypothesis) y empaqueta el resultado en el
 * contrato `MonthlyReport` (engine.ts) que Órbita Mes (R2) consume y R6 archiva.
 *
 * El VEREDICTO se ancla en el déficit sostenido (finding 'deficit-summary'),
 * NUNCA en la balanza (el peso puede subir por músculo — decisión de la dueña).
 *
 * Epic 01 · F5 · T5.2. La IA no participa: 100% reglas.
 */
import type { DailySignals } from './types'
import type { MonthlyReport } from './engine'
import { buildFindings, hashFindings, type FindingsCtx, type PriorReflections } from './findings'
import { buildHypotheses } from './hypothesis'
import { buildStories } from './stories'

/** El id del hallazgo que sostiene el veredicto del mes (déficit, el norte). */
const VERDICT_FINDING_ID = 'deficit-summary'

/**
 * El reporte del mes ensamblado. `month` es 'YYYY-MM' (lo pasa quien llama, con
 * su zona horaria ya resuelta — este módulo es puro y no lee el reloj). Corre
 * los detectores una sola vez y deriva de ahí historias, hipótesis, veredicto y
 * huella, para que todo el reporte hable de EL MISMO set de hallazgos.
 */
export function buildMonthlyReport(
  month: string,
  signals: readonly DailySignals[],
  ctx: FindingsCtx = {},
  prior: PriorReflections = {},
): MonthlyReport {
  const findings = buildFindings(signals, ctx, prior)
  const stories = buildStories(findings)
  const hypotheses = buildHypotheses(findings, stories)
  const verdict = findings.find((f) => f.id === VERDICT_FINDING_ID) ?? null

  return {
    month,
    findingsHash: hashFindings(findings),
    verdict,
    findings,
    stories,
    hypotheses,
  }
}
