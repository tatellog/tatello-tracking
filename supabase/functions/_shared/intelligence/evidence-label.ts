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
import type { EvidenceBar, MonthPattern } from './month-built.ts'
import type { DailySignals } from './types.ts'

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

/** Los grupos que un patrón comparó y cuántos días tiene cada uno. `total`
 *  solo cuando los grupos se traslapan (un grupo contra TODOS tus días): ahí
 *  sumar contaría días dos veces. */
export type PatternSample = { groups: { label: string; days: number }[]; total?: number }

/**
 * La línea de muestra, en plano: "27 días comparados · Con entreno 15 · Sin
 * entreno 12". `null` sin muestra declarada (dato o silencio: nunca se estima).
 */
export function patternSampleLine(sample: PatternSample | null | undefined): string | null {
  if (!sample || sample.groups.length === 0) return null
  const total = sample.total ?? sample.groups.reduce((a, g) => a + g.days, 0)
  if (total <= 0) return null
  const parts = sample.groups.map((g) => `${g.label} ${g.days}`)
  return [`${total} ${total === 1 ? 'día comparado' : 'días comparados'}`, ...parts].join(' · ')
}

/**
 * "Lo que todavía no sabemos" (ST-006, plan §5 D-03): los límites HONESTOS de
 * un hallazgo, derivados de su etiqueta y su muestra. Nunca agrega datos: solo
 * dice qué no prueba. Un dato registrado (constancia) no tiene límites que
 * declarar: es un conteo.
 */
export function evidenceUnknowns(
  p: Pick<MonthPattern, 'kind' | 'sample'>,
  maturityStage: number,
): string[] {
  if (p.kind === 'discovery') return []
  const out = [
    'Por qué pasa. Esto muestra que coincidieron en tus días, no que una cosa cause la otra.',
  ]
  const groups = p.sample?.groups ?? []
  const small = groups.filter((g) => g.days < PATTERN_MIN_DAYS_PER_GROUP)
  if (small.length > 0) {
    const list = small.map((g) => `${g.label}: ${g.days}`).join(', ')
    out.push(
      `Si se sostiene. Hay pocos días en ${small.length === 1 ? 'un grupo' : 'algunos grupos'} (${list}); con ${PATTERN_MIN_DAYS_PER_GROUP} o más en cada uno sería patrón detectado.`,
    )
  } else if (maturityStage <= EARLY_MATURITY_MAX_STAGE) {
    out.push('Si se sostiene. Llevas pocos días con datos; lo sigo mirando.')
  }
  return out
}

/**
 * Qué barras del detalle se dibujan y cuáles bajan a "aún sin registro". Una
 * barra CON denominador y días (total > 0) se dibuja aunque valga 0: "0 de 3
 * días" es evidencia (el lado que no se dio), no un hueco. Sin días, o sin
 * denominador y en 0, no hay registro.
 */
export function splitEvidenceBars(bars: readonly EvidenceBar[]): {
  shown: EvidenceBar[]
  noData: EvidenceBar[]
} {
  const hasData = (b: EvidenceBar) => (b.total != null ? b.total > 0 : b.value > 0)
  return { shown: bars.filter(hasData), noData: bars.filter((b) => !hasData(b)) }
}

/* De qué dimensión con procedencia depende cada patrón. La comida siempre es
 * registro tuyo; sueño y entreno pueden venir del reloj. */
const SOURCE_DIM: Record<string, 'sleep' | 'workout'> = {
  'sleep-deficit': 'sleep',
  'sleep-in-deficit': 'sleep',
  'consistent-sleep': 'sleep',
  'training-protein': 'workout',
  'movement-deficit': 'workout',
  'workout-type-deficit': 'workout',
  'consistent-training': 'workout',
}

/**
 * La fuente del hallazgo (ST-006, decisión de la dueña 13 oct 2026: nombrar
 * AMBOS orígenes cuando los hay). "Con tus registros" si ningún día de la
 * dimensión vino del reloj; "Con tus registros y tu smartwatch" si alguno sí.
 * Solo procedencia: nunca cambia qué se detecta.
 */
export function patternSourceLine(patternId: string, signals: readonly DailySignals[]): string {
  const dim = SOURCE_DIM[patternId]
  const fromWatch =
    dim === 'sleep'
      ? signals.some((s) => s.sleep_minutes != null && s.sleep_source === 'wearable')
      : dim === 'workout'
        ? signals.some((s) => s.trained === true && s.workout_source === 'wearable')
        : false
  return fromWatch ? 'Con tus registros y tu smartwatch' : 'Con tus registros'
}
