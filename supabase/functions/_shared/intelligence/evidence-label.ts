/*
 * Contrato de evidencia (ST-005 · plan maestro §7) — qué TIPO de afirmación es
 * cada cosa que Descubre muestra, y sobre cuántos días se apoya. PURO.
 *
 *   · dato         — Dato registrado: conteo directo de tus registros
 *                    (constancias: "registraste proteína 18 días").
 *   · observacion  — Observación inicial: un patrón que pasó las guardas de su
 *                    detector, pero con poca historia todavía.
 *   · patron       — Patrón detectado: pasó las guardas y hay historia madura.
 *   · hipotesis    — Hipótesis para explorar: interpretación, nunca causa.
 *   · general      — Información general: no es personal.
 *
 * "inicial" vs "detectado" usa el MISMO corte de madurez que la UI ya usaba
 * para "Empieza a asomar" (maturity.ts, etapa ≤ 2 = menos de 21 días con
 * datos útiles) Y, por decisión de la dueña (P13, 13 oct 2026), un mínimo de
 * días en CADA grupo comparado. Cambiar cualquiera de los dos cortes es
 * decisión de producto (plan maestro, regla 10).
 */
import type { MonthPattern } from './month-built.ts'

export type EvidenceLabel = 'dato' | 'observacion' | 'patron' | 'hipotesis' | 'general'

/** El texto visible de cada etiqueta (vocabulario único del plan §7). */
export const EVIDENCE_LABEL_TEXT: Record<EvidenceLabel, string> = {
  dato: 'Dato registrado',
  observacion: 'Observación inicial',
  patron: 'Patrón detectado',
  hipotesis: 'Hipótesis para explorar',
  general: 'Información general',
}

/** Última etapa de madurez que todavía es "temprana" (maturity.ts: etapa 2 =
 *  8-20 días). Es el corte que la UI ya usaba para `early`; no es nuevo. */
export const EARLY_MATURITY_MAX_STAGE = 2

/** Días mínimos por grupo comparado para decir "Patrón detectado" (P13). Las
 *  guardas del detector (≥3 por lado) siguen decidiendo si el patrón aparece. */
export const PATTERN_MIN_DAYS_PER_GROUP = 5

/** La etiqueta de un patrón del mes según su tipo, la madurez de los datos y
 *  su muestra. Sin muestra declarada nunca es "detectado". */
export function monthPatternLabel(
  p: Pick<MonthPattern, 'kind' | 'sample'>,
  maturityStage: number,
): EvidenceLabel {
  if (p.kind === 'discovery') return 'dato'
  if (maturityStage <= EARLY_MATURITY_MAX_STAGE) return 'observacion'
  const groups = p.sample?.groups ?? []
  const enoughSample =
    groups.length > 0 && groups.every((g) => g.days >= PATTERN_MIN_DAYS_PER_GROUP)
  return enoughSample ? 'patron' : 'observacion'
}

/** Los grupos que un patrón comparó y cuántos días tiene cada uno. */
export type PatternSample = { groups: { label: string; days: number }[] }

/**
 * La línea de muestra, en plano: "27 días comparados · Con entreno 15 · Sin
 * entreno 12". `null` sin muestra declarada (dato o silencio: nunca se estima).
 */
export function patternSampleLine(sample: PatternSample | null | undefined): string | null {
  if (!sample || sample.groups.length === 0) return null
  const total = sample.groups.reduce((a, g) => a + g.days, 0)
  if (total <= 0) return null
  const parts = sample.groups.map((g) => `${g.label} ${g.days}`)
  return [`${total} ${total === 1 ? 'día comparado' : 'días comparados'}`, ...parts].join(' · ')
}
