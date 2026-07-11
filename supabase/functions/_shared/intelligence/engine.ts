/*
 * Intelligence Engine · MODELO DE DOMINIO CANÓNICO (R1).
 *
 * La ÚNICA fuente de los contratos del motor determinístico de Stelar
 * (Facts → Findings → Story → Ranking → Hypothesis → MonthlyReport). Lo importan
 * TANTO la app (Metro) COMO las Edge Functions (Deno). TypeScript PURO: nada de
 * React Native, Supabase client ni globals de Deno; solo imports relativos.
 *
 * Ref: docs/epics/epic-01-intelligence-engine.md · docs/architecture/*.md.
 *
 * `Finding` y sus tipos de UI (Chart/Metacognition/FollowUp) se MOVIERON aquí
 * desde features/orbit/findings.ts (que ahora los re-exporta, sin romper nada).
 * Los contratos Fact/Story/Hypothesis/MonthlyReport son la base para F1–F5:
 * definen la forma ANTES de construir cada engine (contracts-first).
 */

/* ── Findings (Engine 2 · ya implementado en findings.ts) ────────────── */

export type FindingCategory =
  | 'deficit'
  | 'movimiento'
  | 'sueno'
  | 'agua'
  | 'proteina'
  | 'alimentacion'

/** Gráfica mínima de evidencia (no dashboard). */
export type Chart =
  | {
      kind: 'weekdayBars'
      unit: string
      bars: { label: string; value: number; highlight: boolean }[]
    }
  | { kind: 'dotTimeline'; dots: ('off' | 'on' | 'strong')[]; caption?: string }

/** Metacognición guiada (ramifica según la respuesta). */
export type Metacognition = {
  question: string
  options: { label: string; answer: string }[]
  /** answer → lo que Stelar responde. */
  replies: Record<string, string>
  /** Segunda pregunta guiada tras la primera respuesta. */
  follow?: { question: string; options: { label: string; answer: string }[] }
}

export type FollowUp =
  | { kind: 'observation'; label: string; text: string }
  | { kind: 'days'; label: string; dates: string[] }
  | { kind: 'next'; label: string }

/** Un HALLAZGO: una relación detectada por reglas (nunca por IA), con evidencia
 *  y números. Es lo que el reporte muestra y lo que la IA solo EXPLICA. */
export type Finding = {
  id: string
  category: FindingCategory
  /** 0–100. Cuánto sostuvo el patrón (semanas/ocasiones), no una probabilidad. */
  confidence: number
  /** El hallazgo, específico y con números. */
  title: string
  /** La dimensión en humano ("tus días con tu meta de agua"): la IA del chat
   *  abre NOMBRÁNDOLA para que cada hallazgo se sienta distinto (no un molde). */
  subject: string
  /** El contenido de la card-constelación en 3 niveles: `lead` = la LECTURA /
   *  palanca (Cormorant italic, voz del coach · el VALOR, no la coincidencia),
   *  `support` = la evidencia con números (Hanken), `caption` = la
   *  metacognición ("día a día no se ve; junto sí" · el diferenciador de Stelar,
   *  hoy visible en la card, no escondido tras "Entender"). El italic jamás es
   *  número crudo ni culpa. */
  phrase: { lead: string; support: string; caption: string }
  /** Muestra chica (pocas ocurrencias): se muestra como "Señal naciente" —
   *  tentativa, sin sello de consistencia lleno. Honestidad sobre el N. */
  emerging?: boolean
  /** `true` = hallazgo de RUPTURA (dónde se te va: rompes la dieta, te saltas el
   *  gym). Lo invisible que frena el mes. El reporte lo enmarca como oportunidad,
   *  nunca como culpa; NO lleva northLink (romper no acerca al objetivo). */
  isObstacle?: boolean
  /** El CONTRAPUNTO en humano ("los días que NO"): caracteriza el reverso con
   *  números, para responder de verdad "¿y los días que no?". */
  contrast?: string
  /** Contexto corto de por qué vale la pena, sin recetar. */
  explanation: string
  /** Conexión con su norte (déficit → objetivo), sin presión. undefined si el
   *  hallazgo no acerca al objetivo (ej. comer más un día). */
  northLink?: string
  /** La HIPÓTESIS de Stelar: otra dimensión que coincidió en esos días
   *  (determinística, tentativa, sin causalidad). undefined si no hay cruce. */
  hypothesis?: string
  /** La PALANCA / foco accionable, ARMADA POR EL MOTOR (no por la IA): en QUÉ
   *  enfocarse desde SUS datos ("cuida los viernes", "cuida tu agua"). Es una
   *  recomendación (manifiesto: Órbita recomienda un foco), NUNCA una orden ni
   *  receta. undefined si el hallazgo no da una palanca clara (observaciones,
   *  muestras chicas). La IA solo la VISTE; nunca la inventa. */
  lever?: string
  /** Métrica de esquina ("18 de 21 entrenamientos"). */
  metric: { value: string; label: string }
  /** Las fechas reales relevantes del hallazgo (para "Ver esos días"). */
  evidenceDates: string[]
  evidenceTitle: string
  charts: Chart[]
  reflectionKey: string
  /** Callback de continuidad entre meses ("En mayo no lo habías notado."). */
  priorCallback?: string
  metacognition: Metacognition
  followUps: FollowUp[]
}

/* ── Contratos v1 de R1 (Engines 1, 3, 4, 5 · aún por implementar) ─────
 *
 * Forma acordada para que F1–F5 construyan contra un contrato estable. Son
 * mínimos y evolucionarán; NO hay engine detrás todavía. Ver el epic 01.
 * ─────────────────────────────────────────────────────────────────────── */

/** Rango de fechas de un cálculo (ISO 'YYYY-MM-DD'). */
export type Period = { start: string; end: string }

/** Engine 1 · Facts: un HECHO agregado. Nunca interpreta, solo calcula. */
export type Fact = {
  /** ej. 'deficit_days', 'avg_protein', 'workout_days', 'avg_sleep_minutes'. */
  kind: string
  value: number
  unit?: string
  /** Cuántos días/registros lo sostienen (honestidad sobre la muestra). */
  evidenceCount: number
  period: Period
}

/** Engine 3 · Story: varios findings encadenados. Coincidencia observada,
 *  NUNCA causa afirmada (línea roja del manifiesto). */
export type Story = {
  id: string
  findingIds: string[]
  /** La secuencia en humano (ej. ["dormiste poco","menos proteína","no déficit"]). */
  chain: string[]
  score: number
}

/** Estado de una hipótesis a lo largo de su ciclo (alimenta R5 · Experiments). */
export type HypothesisStatus = 'open' | 'experimenting' | 'confirmed' | 'discarded' | 'inconclusive'

/** Engine 5 · Hypothesis: SUGIERE, no afirma ("es posible que…"). */
export type Hypothesis = {
  id: string
  text: string
  confidence: number
  status: HypothesisStatus
  sourceFindingId?: string
  sourceStoryId?: string
}

/** El reporte mensual ensamblado: lo que Órbita Mes (R2) consume y R6 archiva.
 *  El veredicto se ancla en déficit sostenido (NO en la balanza). */
export type MonthlyReport = {
  /** 'YYYY-MM'. */
  month: string
  /** Huella de los hallazgos (llave de caché de la voz de IA). */
  findingsHash: string
  verdict: Finding | null
  findings: Finding[]
  stories?: Story[]
  hypotheses?: Hypothesis[]
}
