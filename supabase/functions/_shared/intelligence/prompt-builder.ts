/*
 * Prompt Builder — arma prompts CORTOS y seguros para la voz de IA (AI
 * Foundation, docs/ai-foundation-spec.md · paso 4).
 *
 * Regla del release: la IA EXPLICA el contexto ya resumido; nunca ve
 * registros raw, nunca detecta el patrón (eso ya lo hizo el backend). Este
 * módulo recibe el PeriodContext + los insights determinísticos y produce los
 * mensajes; el modelo y la llamada viven en la edge function (agnóstico de
 * proveedor). `PROMPT_VERSION` versiona prompt+contrato: subirlo invalida el
 * caché sin tocar datos.
 *
 * Puro y compartido: sin React Native, sin Supabase, sin Deno globals.
 */
import { stableStringify } from './context-hash.ts'
import type { PeriodContext } from './context.ts'

/** Sube esto cuando cambie el system prompt, el contrato de salida o el
 *  modelo objetivo — el caché tratará las respuestas viejas como stale. */
export const PROMPT_VERSION = 'v1'

/** Qué superficie pide la voz (para matizar el foco del prompt). */
export type InsightFeature = 'orbita_dia' | 'orbita_semana' | 'orbita_mes' | 'progreso'

export type PromptMessages = {
  system: string
  user: string
  promptVersion: string
}

/*
 * El system prompt: identidad + guardrails + contrato de salida. Guardrails
 * copiados del manifiesto y features/patterns/CLAUDE.md — la IA hereda las
 * barreras, no las inventa. En español porque la salida es la voz visible.
 */
const SYSTEM_PROMPT = [
  'Eres la Voz de Stelar, una app de pérdida de peso sostenible.',
  'Tu trabajo es EXPLICAR con calidez lo que ya apareció en los registros de la usuaria.',
  'NO detectas patrones (el sistema ya los detectó); solo los pones en palabras suaves.',
  '',
  'VOZ: cálida, en segunda persona, femenina, sin tecnicismos, sin lenguaje clínico,',
  'sin exclamaciones, sin culpa, sin presión. Frases cortas. Máximo 2 o 3 frases en total.',
  '',
  'NUNCA digas: "debes comer", "debes entrenar", "tienes un problema", "esto causó aquello",',
  'ningún diagnóstico médico, ningún consejo psicológico, ninguna orden.',
  'NUNCA menciones un número de peso como meta ni compares contra otras personas.',
  'SÍ puedes decir: "en tus registros apareció", "esto coincidió con", "esto se repitió",',
  '"esto llamó mi atención", "podrías observar esto". Observas, no recetas.',
  '',
  'Responde SOLO con JSON válido, sin texto extra, con este formato exacto:',
  '{"voz": [{"text": string, "tone": "accent" | "strong" | null}]}',
  'Cada elemento de "voz" es una frase. "tone" es opcional (null si neutral):',
  '"accent" para la frase emocional del coach, "strong" para el dato que resalta.',
].join('\n')

/** Una línea humana de a qué periodo se refiere (para orientar al modelo). */
function periodLabel(ctx: PeriodContext): string {
  switch (ctx.period) {
    case 'day':
      return 'de hoy'
    case 'week':
      return 'de esta semana'
    case 'month':
      return 'de este mes'
    case 'last30':
      return 'de tus últimos 30 días'
  }
}

/**
 * Arma los mensajes para una superficie. `context` es el resumen compacto (ya
 * sin raw); `insights` son los hallazgos determinísticos ya detectados (texto
 * corto cada uno), que la IA solo redacta — no infiere de cero.
 */
export function buildInsightPrompt(input: {
  feature: InsightFeature
  context: PeriodContext
  /** Hallazgos determinísticos ya detectados por el backend (frases planas).
   *  La IA los explica; si está vacío, explica solo el contexto. */
  insights?: readonly string[]
}): PromptMessages {
  const { context, insights } = input
  const lines: string[] = [
    `Contexto ${periodLabel(context)} (solo agregados, ya sin registros crudos):`,
    stableStringify(context),
  ]
  if (insights && insights.length > 0) {
    lines.push('')
    lines.push('Hallazgos que el sistema ya detectó (explícalos, no inventes otros):')
    for (const i of insights) lines.push(`- ${i}`)
  }
  lines.push('')
  lines.push('Explica esto en voz Stelar, en el JSON pedido. No repitas los números crudos;')
  lines.push('nómbralos en lenguaje humano. Si no hay nada notable, devuelve una sola frase suave.')
  return {
    system: SYSTEM_PROMPT,
    user: lines.join('\n'),
    promptVersion: PROMPT_VERSION,
  }
}
