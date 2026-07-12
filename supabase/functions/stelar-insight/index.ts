// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: stelar-insight
//
// La capa de VOZ del AI Foundation (docs/ai-foundation-spec.md · paso 5).
// Orquesta: lee las señales del periodo (RLS-scoped) → Context Engine →
// context_hash → CACHÉ. Solo si el hash cambió (o el prompt_version) llama a
// gpt-4o-mini para EXPLICAR el contexto; la respuesta se guarda en
// ai_insights. La IA nunca ve registros raw, nunca detecta el patrón.
//
// SELF-CONTAINED A PROPÓSITO: el edge runtime de Supabase NO bootea con
// imports relativos sin extensión (sloppy-imports) — daily-intelligence
// también falla por eso. Por eso la lógica del Context Engine / hash /
// prompt se INLINE aquí en vez de importar de ../_shared/intelligence/. La
// fuente de verdad para app + tests sigue siendo _shared/intelligence/
// (context.ts, context-hash.ts, prompt-builder.ts, deficit.ts); si cambian,
// actualizar esta copia para que produzca el MISMO hash.
//
// GUARDA: features/orbit/__tests__/ai-prompt.test.ts tiene un "hash dorado"
// tripwire — si tocas la agregación o el hash en _shared, ese test truena y
// te recuerda re-sincronizar esta copia (si no, el context_hash cliente vs
// server diverge y el caché nunca acierta).
//
// SECURITY: JWT del caller → client RLS-scoped. No service role. La
// OPENAI_API_KEY vive solo como secret. Errores cálidos y genéricos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

const MODEL = 'gpt-4o-mini'
// v2: prompt del chat fact-led (nombra la dimensión, contrapunto, sin relleno).
// Subirla invalida el caché viejo (respuestas genéricas de v1).
const PROMPT_VERSION = 'v10'
const DEFICIT_FLOOR_RATIO = 0.6
const SLEEP_ENOUGH_MINUTES = 420

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/* ── deficit.ts (inline) ─────────────────────────────────────────────── */
function isDeficitDay(calories, target): boolean {
  if (target == null || target <= 0) return false
  if (calories == null || calories <= 0) return false
  return calories <= target && calories >= target * DEFICIT_FLOOR_RATIO
}

/* ── context.ts (inline) — resumen compacto, solo agregados ──────────── */
const round = (n: number) => Math.round(n)
const round1 = (n: number) => Math.round(n * 10) / 10
function avgOf(values): number | null {
  const nums = values.filter((v) => v != null)
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
function nutritionOf(signals, target) {
  const withFood = signals.filter((s) => (s.meal_count ?? 0) > 0 || (s.calories ?? 0) > 0)
  const avgCal = avgOf(withFood.map((s) => s.calories))
  const avgProt = avgOf(withFood.map((s) => s.protein_g))
  const deficitDays = signals.filter((s) => isDeficitDay(s.calories, target)).length
  const surplusDays =
    target != null && target > 0
      ? signals.filter((s) => s.calories != null && s.calories > target).length
      : 0
  return {
    avgCalories: avgCal != null ? round(avgCal) : null,
    avgProtein: avgProt != null ? round(avgProt) : null,
    deficitDays,
    surplusDays,
    daysLogged: withFood.length,
  }
}
function activityOf(signals) {
  const trained = signals.filter((s) => s.trained === true)
  const kcal = avgOf(trained.map((s) => s.workout_kcal))
  return { workoutDays: trained.length, workoutKcalAvg: kcal != null ? round(kcal) : null }
}
function sleepOf(signals) {
  const avg = avgOf(signals.map((s) => s.sleep_minutes))
  const daysAbove7h = signals.filter((s) => (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH_MINUTES).length
  return { avgSleepMinutes: avg != null ? round(avg) : null, daysAbove7h }
}
function bodyOf(signals) {
  const weighed = signals
    .filter((s) => s.weight_kg != null && s.day != null)
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
  if (weighed.length === 0) return { weightChangeKg: null, latestWeightKg: null }
  const latest = weighed[weighed.length - 1].weight_kg
  const change =
    weighed.length >= 2 ? weighed[weighed.length - 1].weight_kg - weighed[0].weight_kg : null
  return {
    weightChangeKg: change != null ? round1(change) : null,
    latestWeightKg: round1(latest),
  }
}
function dateRangeOf(signals) {
  const days = signals.map((s) => s.day).filter((d) => d != null)
  if (days.length === 0) return null
  days.sort((a, b) => a.localeCompare(b))
  return { start: days[0], end: days[days.length - 1] }
}
function comparisonOf(cur, prevSignals, target) {
  const prev = {
    nutrition: nutritionOf(prevSignals, target),
    activity: activityOf(prevSignals),
    sleep: sleepOf(prevSignals),
    body: bodyOf(prevSignals),
  }
  const numDelta = (a, b) => (a != null && b != null ? round1(a - b) : null)
  return {
    avgCaloriesDelta: numDelta(cur.nutrition.avgCalories, prev.nutrition.avgCalories),
    avgProteinDelta: numDelta(cur.nutrition.avgProtein, prev.nutrition.avgProtein),
    deficitDaysDelta: cur.nutrition.deficitDays - prev.nutrition.deficitDays,
    workoutDaysDelta: cur.activity.workoutDays - prev.activity.workoutDays,
    avgSleepMinutesDelta: numDelta(cur.sleep.avgSleepMinutes, prev.sleep.avgSleepMinutes),
    weightChangeKgDelta: numDelta(cur.body.weightChangeKg, prev.body.weightChangeKg),
  }
}
function buildPeriodContext(input) {
  const { period, signals, calorieTarget, previous } = input
  const ctx = {
    period,
    dateRange: dateRangeOf(signals),
    nutrition: nutritionOf(signals, calorieTarget),
    activity: activityOf(signals),
    sleep: sleepOf(signals),
    body: bodyOf(signals),
    patterns: [],
  }
  if (previous && previous.length > 0) ctx.vsPrevious = comparisonOf(ctx, previous, calorieTarget)
  return ctx
}

/* ── context-hash.ts (inline) — fingerprint estable ──────────────────── */
function stableStringify(value): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
function hashContext(context): string {
  return fnv1aHex(stableStringify(context))
}

/* ── prompt-builder.ts (inline) — guardrails horneados ───────────────── */
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

function periodLabel(period: string): string {
  if (period === 'day') return 'de hoy'
  if (period === 'week') return 'de esta semana'
  if (period === 'month') return 'de este mes'
  return 'de tus últimos 30 días'
}

function buildInsightPrompt(context, insights) {
  const lines = [
    `Contexto ${periodLabel(context.period)} (solo agregados, ya sin registros crudos):`,
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
  return { system: SYSTEM_PROMPT, user: lines.join('\n') }
}

/* ── prompt de Órbita Mes: REFORMULAR hallazgos por id ────────────────── */
// La IA no ve datos crudos ni detecta nada: recibe hallazgos YA detectados
// (lead + support + caption determinísticos) y solo reescribe lead/caption en
// voz Stelar, más cálidos/personales, SIN tocar `support` (que lleva números).
const FINDINGS_SYSTEM_PROMPT = [
  'Eres la Voz de Stelar, una app de pérdida de peso sostenible.',
  'Recibes hallazgos que el sistema YA detectó en los registros de la usuaria.',
  'Tu único trabajo es REESCRIBIR, por cada hallazgo, dos textos cortos:',
  '- "lead": la lectura cálida (una frase, voz del coach).',
  '- "caption": una nota breve que ayuda a verlo (una frase).',
  'NO detectas patrones, NO agregas hallazgos, NO cambias su significado.',
  '',
  'REGLAS DURAS:',
  'NO inventes números ni datos nuevos. NO pongas cifras en lead ni caption.',
  'NO afirmes causa ("esto causó aquello"); son coincidencias observadas.',
  'NUNCA digas "debes", "deberías", "tienes que", "intenta", "prueba", "come menos",',
  '"come más", "duerme más", "sube tu proteína", ni ninguna sugerencia de cambiar',
  'una conducta: describe lo que YA pasó, nunca lo que hacer después.',
  'NO diagnostiques, NO uses lenguaje clínico ("atracón", "trastorno", "ansiedad"),',
  'NO culpes. NO menciones un peso como meta ni compares con otras personas.',
  'VOZ: cálida, segunda persona femenina, frases cortas, sin exclamaciones, sin',
  'emojis, sin tecnicismos. Conserva el MISMO id de cada hallazgo.',
  '',
  'Responde SOLO con JSON válido, sin texto extra, con este formato exacto:',
  '{"cards": [{"id": string, "lead": string, "caption": string}]}',
].join('\n')

function buildFindingsVoicePrompt(findings) {
  const lines = ['Hallazgos ya detectados (reescribe lead y caption de cada uno, conserva el id):']
  for (const f of findings) {
    lines.push('')
    lines.push(`id: ${f.id}`)
    lines.push(`lead: ${f.lead}`)
    lines.push(`dato (no lo repitas literal, no inventes otro): ${f.support}`)
    lines.push(`caption: ${f.caption}`)
  }
  lines.push('')
  lines.push('Devuelve el JSON pedido con un elemento por hallazgo, mismo id.')
  return { system: FINDINGS_SYSTEM_PROMPT, user: lines.join('\n') }
}

const CardsSchema = z.object({
  cards: z
    .array(
      z.object({
        id: z.string().min(1),
        lead: z.string().trim().min(1).max(240),
        caption: z.string().trim().min(1).max(240),
      }),
    )
    .min(1)
    .max(4),
})

/* ── Órbita Mes · CHAT guiado: la IA conduce 3-4 turnos sobre UN hallazgo ─ */
// La IA no detecta ni inventa: toma el hallazgo determinístico y, por turno,
// redacta un mensaje corto + 3 chips de REACCIÓN de la usuaria (nunca acción).
// El cliente controla el conteo y el cierre (isFinal); el turno de
// metacognición si/no/nunca lo maneja el cliente, no la IA.
const CHAT_SYSTEM_PROMPT = [
  'Eres la Voz de Stelar (app de pérdida de peso sostenible). Conversas con calidez',
  'sobre UN hallazgo que el SISTEMA ya detectó en los registros de ELLA. No detectas',
  'nada nuevo ni inventas: pones en palabras cálidas lo que ya está.',
  '',
  'VOZ: como una amiga cercana que de verdad leyó su mes y le importa. Segunda',
  'persona femenina, cálida, concreta. MÁXIMO 2 frases cortas — nunca un párrafo.',
  'Sin exclamaciones, sin emojis, sin tecnicismos. Nombra SIEMPRE su déficit o la',
  'dimensión del hallazgo (agua, sueño, entrenos) para que se sienta sobre SUS días.',
  '',
  'DI UNA COSA CON SEGURIDAD. La OBSERVACIÓN (lo que pasó en sus días) se afirma',
  'directa: "los días que no entrenaste, comiste más" ✓, NO "podría estar',
  'relacionado". Solo la CAUSA se evita. Reconoce lo que SÍ hizo (sus entrenos, sus',
  'días en déficit) sin culpa por lo que no. Ella no quiere que le CUENTES sus',
  'números (ya los sabe); quiere que le muestres algo que NO había notado.',
  '',
  'REGLAS DURAS (romperlas hace la respuesta inservible):',
  '- PROHIBIDO TITUBEAR: nada de "podría", "puede ser", "quizás", "tal vez",',
  '  "un espacio para reflexionar". Si no tienes algo concreto que decir, dilo corto',
  '  y seguro, sin muletillas de relleno.',
  '- NUNCA le pases la tarea: no digas "reflexiona", "piensa en", "cómo te sientes".',
  '  Si hay algo que mirar, lo dices TÚ. Eres tú la que leyó su mes.',
  '- Los números SÍ van en el "message" como EVIDENCIA concreta ("los otros 12 días',
  '  no llegaron", "en 8 de esos días entrenaste"). En "chips" y "focus": SIN números.',
  '- NO afirmes causa: son coincidencias observadas ("van juntos", no "X causó Y").',
  '- NO recetes ni ordenes (dieta, rutina, "debes/come menos/duerme más"); NADA',
  '  clínico ("atracón","trastorno"); NADA de culpa ni comparar con otras personas.',
  '- PROHIBIDO el relleno: "interesante", "algo especial", "cada día cuenta",',
  '  "sigue así". Si ibas a decir "interesante", di algo concreto del hallazgo.',
  '- Si ella dijo "no lo había notado", NO digas que lo notó o lo sabía; di lo',
  '  contrario: día a día no se ve, junto sí.',
  '',
  'Das 3 "chips": reacciones o preguntas de ELLA sobre sus datos, 2-6 palabras',
  '(ej. "¿Y los días que no?", "¿Es casualidad?", "Muéstrame esos días"). Nunca',
  'chips de acción/consejo ("¿qué hago?", "debería...").',
  '',
  'Responde SOLO JSON válido, EXACTO (sin texto fuera del JSON):',
  '{"message":{"text":string,"tone":"accent"|"strong"|null},"chips":[string,string,string],"focus":string|null}',
  'Turnos normales: "focus":null. En el CIERRE: "chips":[] y "focus" = la palanca',
  'corta (≤9 palabras, en QUÉ enfocarse, sin cifras ni orden, ej. "cuida los viernes").',
].join('\n')

function buildChatTurnPrompt(finding, path, turnIndex, isFinal) {
  const lines = ['Hallazgo (verdad del sistema, no lo repitas literal ni con cifras):']
  if (finding.subject) lines.push(`- es sobre: ${finding.subject}`)
  if (finding.lead) lines.push(`- lectura semilla (no la copies literal): ${finding.lead}`)
  lines.push(`- evidencia: ${finding.support}`)
  if (finding.northLink) lines.push(`- conexión con su objetivo: ${finding.northLink}`)
  if (finding.hypothesis) lines.push(`- otra coincidencia (tentativa): ${finding.hypothesis}`)
  if (finding.contrast) lines.push(`- el contrapunto (los días que NO): ${finding.contrast}`)
  lines.push('')
  if (path && path.length > 0) {
    lines.push(`Ella eligió antes: ${path.map((p) => `"${p}"`).join(' → ')}`)
    lines.push('PRIMERO contesta su pregunta con el dato, DIRECTO; la calidez va DESPUÉS,')
    lines.push('nunca en vez de contestar. No la esquives con una frase positiva.')
    lines.push('Si pregunta por "los días que no" o el contrapunto, respóndelo con esa')
    lines.push('frase, directo. Si pregunta "¿es casualidad?", contéstale honesto (no')
    lines.push('afirmes causa, pero di que los dos van juntos y vale mirarlo); NO cambies')
    lines.push('el tema al lado positivo.')
    const last = path[path.length - 1] ?? ''
    if (/no lo hab[ií]a notado/i.test(last)) {
      lines.push('Su última reacción: NO lo había notado. PROHIBIDO decir que lo notó o que')
      lines.push('ya lo sabía; reconoce lo contrario: día a día no se ve, junto sí.')
    }
  }
  lines.push('')
  // Regla transversal: cada turno AVANZA. La lectura y la evidencia ya se le
  // mostraron en pantalla antes de abrir el chat; repetirlas (o repetir un turno
  // anterior) hace que se sienta que "da vueltas". Cada mensaje aporta algo nuevo.
  lines.push('NO repitas lo que ya está en la pantalla ni lo que dijiste en un turno')
  lines.push('anterior. Cada turno AVANZA con algo nuevo (el contrapunto, la coincidencia')
  lines.push('tentativa, o hacia dónde mirar). Si no tienes nada nuevo, ve al cierre.')
  if (isFinal) {
    if (finding.lever) {
      // La palanca YA la decidió el motor. La IA solo la viste; no la reinventa.
      lines.push(
        `Este es el CIERRE. La PALANCA ya está decidida por el sistema: "${finding.lever}".`,
      )
      lines.push('Ciérrale vistiéndola con calidez y nombrando por qué (desde el hallazgo), SIN')
      lines.push('cambiarle el sentido ni proponer otra. Recomendación, no orden.')
      lines.push(`En "focus" devuelve EXACTAMENTE esa palanca: "${finding.lever}". Sin cifras,`)
      lines.push('sin culpa. Sin preguntas. "chips": [].')
    } else {
      // Sin palanca (muestra chica / observación): NO inventar una.
      lines.push('Este es el CIERRE. NO hay palanca clara (poca evidencia): NO inventes una ni')
      lines.push('receta. Cierra observando con calidez ("lo sigo mirando contigo"). "focus":')
      lines.push('null. Sin culpa. Sin preguntas. "chips": [].')
    }
  } else if (turnIndex === 0) {
    const subj = finding.subject ?? 'lo que apareció en sus días'
    lines.push(`Turno de APERTURA. Empieza NOMBRANDO ${subj}, pero la lectura y la`)
    lines.push('evidencia YA están en pantalla: NO las repitas — da un paso más (una matiz')
    lines.push('o hacia el contrapunto). PROHIBIDO abrir con "he notado algo interesante" o')
    lines.push('frases genéricas. Da 3 chips.')
  } else {
    lines.push('Sigue la charla, específico a lo que eligió, con info NUEVA. Si encaja,')
    lines.push('menciona la otra coincidencia o el contrapunto. Da 3 chips.')
  }
  return { system: CHAT_SYSTEM_PROMPT, user: lines.join('\n') }
}

const ChatTurnSchema = z.object({
  message: z.object({
    text: z.string().trim().min(1).max(400),
    tone: z.enum(['accent', 'strong']).nullable().optional(),
  }),
  // Laxo A PROPÓSITO: si el modelo devuelve 4 chips o uno largo, NO se rechaza el
  // turno entero — `safeChips` los limpia/recorta a 3. (Antes .max(3) + .max(48)
  // por item tiraba el turno completo a la basura por un chip mal formado.)
  chips: z.array(z.string()).optional().default([]),
  // La palanca corta y accionable, SOLO en el cierre ("cuida el agua el finde").
  // Es lo que la usuaria puede "quedarse presente" como foco concreto.
  focus: z.string().trim().max(160).nullable().optional(),
})

// Chips deterministas de reserva: rellenan si la IA devuelve <3 chips seguros.
const SAFE_CHIPS = [
  'Muéstrame esos días',
  'No lo había notado',
  '¿Y los días que no?',
  '¿Es casualidad?',
  'Me gusta verlo así',
]

/* ── Experimento (R5): la IA redacta el FOCO del hilo elegido ──────────────
 * La usuaria eligió seguir un hilo (2 semanas). La IA NO detecta ni receta:
 * redacta UNA frase de foco que nombra la dimensión y la ata a su déficit.
 * Recomendar un foco = sí; recetar conducta = NUNCA (línea roja). El backstop
 * (unsafeText + BANNED_LEXICON) rechaza dígitos y prescriptivo → fallback. */
const EXPERIMENT_SYSTEM_PROMPT = [
  'Eres la Voz de Stelar, una app de pérdida de peso sostenible.',
  'La usuaria eligió SEGUIR UN HILO: un experimento corto sobre una relación que',
  'el sistema YA detectó en SUS datos. Tú NO detectas ni inventas nada.',
  '',
  'Escribe UNA sola frase cálida: en qué PONER UN OJO estas semanas, nombrando la',
  'dimensión concreta y conectándola con su déficit (su objetivo).',
  '',
  'REGLA DURA: recomiendas un FOCO, NUNCA una orden ni una conducta. PROHIBIDO',
  'decirle qué hacer ("toma más agua", "duerme antes", "come menos", "sube tu',
  'proteína", "debes", "deberías", "intenta"). No es una receta ni un plan. Es',
  '"mira si esto va de la mano con tu déficit".',
  '',
  'VOZ: cálida, segunda persona femenina, UNA frase corta, sin exclamaciones, sin',
  'emojis, sin tecnicismos, SIN cifras (los números viven en el sistema). NO',
  'afirmes causa (es una coincidencia por observar). No menciones días ni',
  'porcentajes. No menciones el peso como meta ni compares con otras personas.',
  'Nada de lenguaje clínico ni culpa. NOMBRA la dimensión; una frase que no la',
  'nombra no sirve.',
  '',
  'La frase es de OBSERVACIÓN, no de acción. Bien: "pon un ojo en...", "mira si...",',
  '"fíjate si...". Mal: cualquier verbo de conducta ("toma", "bebe", "come",',
  '"duerme", "aumenta", "reduce", "prioriza", "evita", "camina", "entrena").',
  '',
  'Responde SOLO JSON válido, exacto: {"text": string}',
].join('\n')

function buildExperimentPrompt(exp: { metricLabel: string; hypothesis: string; subject?: string }) {
  const lines = ['El hilo que sigue (verdad del sistema, no lo repitas literal):']
  lines.push(`- sigue: ${exp.metricLabel}`)
  lines.push(`- su relación tentativa con el déficit: ${exp.hypothesis}`)
  if (exp.subject) lines.push(`- en humano: ${exp.subject}`)
  lines.push('')
  lines.push('Escribe UNA frase: en qué poner un ojo estas semanas, nombrando la')
  lines.push('dimensión y su posible vínculo con su déficit. FOCO, no orden. Sin cifras.')
  return { system: EXPERIMENT_SYSTEM_PROMPT, user: lines.join('\n') }
}

const ExperimentSchema = z.object({ text: z.string().trim().min(1).max(240) })

// Backstop EXTRA solo del experimento (no toca el BANNED_LEXICON compartido para
// no crear falsos positivos en chat/cards). Atrapa verbos de CONDUCTA que el
// modelo podría parafrasear (imperativo + infinitivo), SIN bloquear los de
// OBSERVACIÓN que el foco sí usa (pon/mira/fíjate/nota/observa). Si dispara →
// 502 → el cliente cae al texto determinístico de la hipótesis.
const EXPERIMENT_PRESCRIPTIVE =
  /\b(toma|tomar|tom[aá]te|bebe|beber|come|comer|desayuna|cena|cenar|duerme|dormir|acu[eé]state|aumenta|aumentar|incrementa|incrementar|eleva|elevar|sube|subir|reduce|reducir|disminuye|disminuir|baja|bajar|agrega|agregar|a[ñn]ade|a[ñn]adir|evita|evitar|elimina|eliminar|deja de|prioriza|priorizar|enf[oó]cate|conc[eé]ntrate|procura|procurar|camina|caminar|mu[eé]vete|entrena|entrenar|ejerc[ií]tate|hidr[aá]tate|hidratarte|mant[eé]n|mantener|necesitas|hace falta|hay que|conviene)\b/i

/* ── request / response ──────────────────────────────────────────────── */
const RequestSchema = z.object({
  feature: z.enum([
    'orbita_dia',
    'orbita_semana',
    'orbita_mes',
    'orbita_mes_chat',
    'experimento',
    'progreso',
  ]),
  periodType: z.enum(['day', 'week', 'month', 'last30']),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  insights: z.array(z.string().max(200)).max(8).optional(),
  // Órbita Mes: hallazgos estructurados a reformular (voz por card).
  findings: z
    .array(
      z.object({
        id: z.string().max(60),
        lead: z.string().max(200),
        support: z.string().max(200),
        caption: z.string().max(200),
      }),
    )
    .max(4)
    .optional(),
  // Órbita Mes CHAT: el hallazgo + estado del turno (cliente controla conteo).
  finding: z
    .object({
      id: z.string().max(60),
      subject: z.string().max(120).optional(),
      lead: z.string().max(200).optional(),
      support: z.string().max(200),
      northLink: z.string().max(200).nullable().optional(),
      hypothesis: z.string().max(240).nullable().optional(),
      contrast: z.string().max(240).nullable().optional(),
      lever: z.string().max(120).nullable().optional(),
    })
    .optional(),
  findingsHash: z.string().max(128).optional(),
  turnIndex: z.number().int().min(0).max(3).optional(),
  isFinal: z.boolean().optional(),
  path: z.array(z.string().max(48)).max(4).optional(),
  // Experimento (R5): la IA redacta el FOCO. Solo el dato humano, nunca la DB.
  experiment: z
    .object({
      metricLabel: z.string().max(120),
      hypothesis: z.string().max(240),
      subject: z.string().max(120).optional(),
    })
    .optional(),
})

const VozSchema = z.object({
  voz: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(400),
        tone: z.enum(['accent', 'strong']).nullable().optional(),
      }),
    )
    .min(1)
    .max(4),
})

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dedupeByDay(rows) {
  const byDay = new Map()
  for (const r of rows) {
    if (r.day == null) continue
    byDay.set(r.day, r)
  }
  return [...byDay.values()]
}

async function generateVoz(system: string, user: string, openaiKey: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    console.error('stelar-insight: OpenAI error', res.status)
    return null
  }
  const completion = await res.json()
  const content = completion?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  let raw
  try {
    raw = JSON.parse(content)
  } catch {
    return null
  }
  const parsed = VozSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

async function generateCards(system: string, user: string, openaiKey: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    console.error('stelar-insight: OpenAI error (cards)', res.status)
    return null
  }
  const completion = await res.json()
  const content = completion?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  let raw
  try {
    raw = JSON.parse(content)
  } catch {
    return null
  }
  const parsed = CardsSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

async function generateChatTurn(
  system: string,
  user: string,
  openaiKey: string,
  temperature = 0.6,
) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 320,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    console.error('stelar-insight: OpenAI error (chat)', res.status)
    return null
  }
  const completion = await res.json()
  const content = completion?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  let raw
  try {
    raw = JSON.parse(content)
  } catch {
    return null
  }
  const parsed = ChatTurnSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

async function generateExperiment(system: string, user: string, openaiKey: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 120,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    console.error('stelar-insight: OpenAI error (experimento)', res.status)
    return null
  }
  const completion = await res.json()
  const content = completion?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  let raw
  try {
    raw = JSON.parse(content)
  } catch {
    return null
  }
  const parsed = ExperimentSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

// Backstop de contenido: descarta texto con dígitos (número inventado) o léxico
// prescriptivo/clínico. Compartido por la voz-por-card y el chat.
const BANNED_LEXICON =
  /debes|deber[ií]as|tienes que|intenta|prueba|come m[aá]s|come menos|duerme|sube tu|baja tu|atrac[oó]n|trastorno|ansiedad|depres|diagn[oó]stic|terapia|tca|culpa|tu problema/i
// Rechaza dígitos (número inventado), exclamaciones y emojis (Capa 2 los prohíbe:
// generan ansiedad) y el léxico prescriptivo/clínico de la línea roja.
const unsafeText = (s: string) =>
  /\d/.test(s) || /!/.test(s) || /\p{Extended_Pictographic}/u.test(s) || BANNED_LEXICON.test(s)

// El MENSAJE del chat SÍ puede llevar números: son EVIDENCIA concreta ("los otros
// 12 días no llegaron"), que la usuaria pide. La IA los repite siempre → banearlos
// rechazaba TODO turno. Chips y foco (palanca) siguen SIN dígitos (unsafeText).
const unsafeMessage = (s: string) =>
  /!/.test(s) || /\p{Extended_Pictographic}/u.test(s) || BANNED_LEXICON.test(s)

// Deja 3 chips seguros: filtra los prohibidos y rellena con SAFE_CHIPS.
function safeChips(chips: string[]): string[] {
  const out: string[] = []
  for (const c of chips) if (!unsafeText(c) && !out.includes(c)) out.push(c)
  for (const c of SAFE_CHIPS) {
    if (out.length >= 3) break
    if (!out.includes(c)) out.push(c)
  }
  return out.slice(0, 3)
}

// El chat NO puede rellenar: muletillas prohibidas + exigir que el mensaje
// nombre algo CONCRETO del hallazgo (el día/dimensión, o "déficit").
const CHAT_FILLER = /interesante|cada d[ií]a cuenta|sigue as[ií]|algo especial/i
// Nunca afirmar que ella lo notó / ya lo sabía si su última reacción fue que NO
// lo había notado: el cierre "es bueno que lo hayas notado" contradice su
// respuesta y rompe la credibilidad. Rechaza → el cliente cae al beat determinístico.
const DIDNT_NOTICE = /no lo hab[ií]a notado/i
const CLAIMS_AWARENESS =
  /lo hayas notado|lo notaste|ya lo sab[ií]as|lo sab[ií]as|ya lo ve[ií]as|lo ve[ií]as/i
function contradictsReaction(text: string, path: string[]): boolean {
  const last = path[path.length - 1] ?? ''
  return DIDNT_NOTICE.test(last) && CLAIMS_AWARENESS.test(text)
}
function chatAnchored(text: string, finding): boolean {
  const low = text.toLowerCase()
  const stop = new Set(['los', 'las', 'tus', 'del', 'con', 'meta', 'dias', 'días', 'que', 'una'])
  const stems = String(finding?.subject ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w))
    .map((w) => w.slice(0, 5))
  // Ancla amplia: cualquier término de dimensión cuenta como "on-topic" (antes
  // solo el stem del subject + déficit → rechazaba respuestas válidas que no
  // repetían la palabra exacta del subject).
  stems.push('défic', 'defic', 'agua', 'sueñ', 'sueno', 'entren', 'movi', 'prote', 'objetiv')
  return stems.some((s) => low.includes(s))
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado.' }, 401)

    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('stelar-insight: missing OPENAI_API_KEY')
      return json({ error: 'La voz no está disponible ahora.' }, 500)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    )
    const { data: userData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !userData?.user) return json({ error: 'No autorizado.' }, 401)
    const userId = userData.user.id

    const parsed = RequestSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return json({ error: 'Petición inválida.' }, 400)
    const { feature, periodType, periodStart, periodEnd, insights, findings } = parsed.data
    const chatFinding = parsed.data.finding
    const chatHash = parsed.data.findingsHash
    const chatTurnIndex = parsed.data.turnIndex ?? 0
    const chatIsFinal = parsed.data.isFinal === true
    const chatPath = parsed.data.path ?? []
    const experiment = parsed.data.experiment

    // ── Órbita Mes: voz POR HALLAZGO. La IA solo reformula; la llave del caché
    // es el hash de los hallazgos que manda el cliente (NO el Context Engine),
    // así que no toca el hash dorado. Sin queries de señales: cero DB reads. ──
    if (feature === 'orbita_mes' && findings && findings.length > 0) {
      const findingsHash = fnv1aHex(stableStringify(findings))
      const { data: cachedM } = await supabase
        .from('ai_insights')
        .select('response, context_hash, prompt_version, expires_at')
        .eq('feature', feature)
        .eq('period_type', periodType)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle()
      const freshM =
        cachedM &&
        cachedM.context_hash === findingsHash &&
        cachedM.prompt_version === PROMPT_VERSION &&
        (cachedM.expires_at == null || new Date(cachedM.expires_at).getTime() > Date.now())
      if (freshM) return json({ ...cachedM.response, cached: true })

      const prompt = buildFindingsVoicePrompt(findings)
      const cardsVoice = await generateCards(prompt.system, prompt.user, openaiKey)
      if (!cardsVoice) return json({ error: 'No pudimos leer tu voz ahora.' }, 502)
      // BACKSTOP determinístico (el output se cachea → una mala generación
      // persistiría): descarta cards con dígitos (número inventado) o con
      // léxico prescriptivo/clínico. Un id descartado → el cliente cae a su
      // texto determinístico para ESA card (voice?.[id] ?? finding.phrase).
      const allowed = new Set(findings.map((f) => f.id)) // la IA nunca añade hallazgos
      const safe = cardsVoice.cards.filter(
        (c) => allowed.has(c.id) && !unsafeText(c.lead) && !unsafeText(c.caption),
      )
      if (safe.length === 0) return json({ error: 'No pudimos leer tu voz ahora.' }, 502)
      const responseM = { cards: safe }

      const { error: upErr } = await supabase.from('ai_insights').upsert(
        {
          user_id: userId,
          feature,
          period_type: periodType,
          period_start: periodStart,
          period_end: periodEnd,
          context_hash: findingsHash,
          prompt_version: PROMPT_VERSION,
          response: responseM,
        },
        { onConflict: 'user_id,feature,period_type,period_start,period_end' },
      )
      if (upErr) console.error('stelar-insight: cache upsert failed (mes)', upErr.message)
      return json({ ...responseM, cached: false })
    }

    // ── Órbita Mes CHAT: un turno de la charla guiada sobre UN hallazgo. La IA
    // solo redacta message + 3 chips (reacción, nunca acción). Caché = árbol
    // acumulativo de turnos visitados, keyed por findingsHash (si los hallazgos
    // cambian, se descarta). El cliente controla el conteo y el cierre. ──
    if (feature === 'orbita_mes_chat' && chatFinding && chatHash) {
      const pathKey = `${chatFinding.id}|${chatPath.join('>')}`
      const { data: cachedC } = await supabase
        .from('ai_insights')
        .select('response, context_hash, prompt_version, expires_at')
        .eq('feature', feature)
        .eq('period_type', periodType)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle()
      const treeFresh =
        cachedC &&
        cachedC.context_hash === chatHash &&
        cachedC.prompt_version === PROMPT_VERSION &&
        (cachedC.expires_at == null || new Date(cachedC.expires_at).getTime() > Date.now())
      const tree =
        treeFresh && cachedC.response && typeof cachedC.response === 'object'
          ? (cachedC.response.turns ?? {})
          : {}
      if (tree[pathKey]) return json({ ...tree[pathKey], cached: true })

      const prompt = buildChatTurnPrompt(chatFinding, chatPath, chatTurnIndex, chatIsFinal)
      // Apertura (turno 0) con más variedad léxica para que no converja al molde.
      const temp = chatTurnIndex === 0 ? 0.75 : 0.6
      const turn = await generateChatTurn(prompt.system, prompt.user, openaiKey, temp)
      // Backstop anti-relleno: rechaza muletillas, dígitos/clínico, y (salvo el
      // cierre) mensajes que no anclan en el hallazgo → el cliente cae al beat.
      const rejectReason = !turn
        ? 'no-turn'
        : unsafeMessage(turn.message.text)
          ? 'unsafe'
          : CHAT_FILLER.test(turn.message.text)
            ? 'filler'
            : contradictsReaction(turn.message.text, chatPath)
              ? 'contradiction'
              : !chatIsFinal && !chatAnchored(turn.message.text, chatFinding)
                ? 'not-anchored'
                : null
      if (rejectReason) {
        console.error(
          `chat rejected [${rejectReason}] turn=${chatTurnIndex} final=${chatIsFinal} subject="${chatFinding?.subject}" text="${turn?.message?.text ?? ''}"`,
        )
        return json({ error: 'No pudimos leer tu voz ahora.' }, 502)
      }
      // El foco solo vive en el cierre; se descarta si trae lenguaje inseguro
      // (clínico/culpa). Recomendar una palanca SÍ es manifiesto-safe.
      const focus = chatIsFinal && turn.focus && !unsafeText(turn.focus) ? turn.focus.trim() : null
      const node = {
        message: turn.message,
        chips: chatIsFinal ? [] : safeChips(turn.chips),
        focus,
      }

      // Guarda de tamaño (response ≤ 20000 chars): si el árbol crece de más, lo
      // reinicia con solo el nodo actual en vez de fallar el upsert.
      let nextTree = { ...tree, [pathKey]: node }
      if (JSON.stringify(nextTree).length > 18000) nextTree = { [pathKey]: node }

      const { error: upErr } = await supabase.from('ai_insights').upsert(
        {
          user_id: userId,
          feature,
          period_type: periodType,
          period_start: periodStart,
          period_end: periodEnd,
          context_hash: chatHash,
          prompt_version: PROMPT_VERSION,
          response: { turns: nextTree },
        },
        { onConflict: 'user_id,feature,period_type,period_start,period_end' },
      )
      if (upErr) console.error('stelar-insight: cache upsert failed (chat)', upErr.message)
      return json({ ...node, cached: false })
    }

    // ── Experimento (R5): la IA redacta el FOCO del hilo. Solo recibe la métrica
    // humana + la hipótesis (nunca la DB). Recomienda un foco, JAMÁS receta
    // conducta (backstop unsafeText/BANNED_LEXICON). Fallback cliente = el
    // determinístico. Caché = una fila directa por periodo, keyed por el hash del
    // payload del experimento. ──
    if (feature === 'experimento' && experiment) {
      const expHash = fnv1aHex(stableStringify(experiment))
      const { data: cachedE } = await supabase
        .from('ai_insights')
        .select('response, context_hash, prompt_version, expires_at')
        .eq('feature', feature)
        .eq('period_type', periodType)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle()
      const expFresh =
        cachedE &&
        cachedE.context_hash === expHash &&
        cachedE.prompt_version === PROMPT_VERSION &&
        (cachedE.expires_at == null || new Date(cachedE.expires_at).getTime() > Date.now())
      if (
        expFresh &&
        cachedE.response &&
        typeof cachedE.response === 'object' &&
        cachedE.response.text
      ) {
        return json({ ...cachedE.response, cached: true })
      }

      const prompt = buildExperimentPrompt(experiment)
      const out = await generateExperiment(prompt.system, prompt.user, openaiKey)
      // Backstop: sin dígitos/prescriptivo (unsafeText) y DEBE nombrar la dimensión
      // o el déficit (chatAnchored). Si no, cae al determinístico del cliente.
      const rejected =
        !out ||
        unsafeText(out.text) ||
        EXPERIMENT_PRESCRIPTIVE.test(out.text) ||
        !chatAnchored(out.text, { subject: experiment.subject ?? experiment.metricLabel })
      if (rejected) return json({ error: 'No pudimos redactar el hilo ahora.' }, 502)

      const response = { text: out.text }
      const { error: upErr } = await supabase.from('ai_insights').upsert(
        {
          user_id: userId,
          feature,
          period_type: periodType,
          period_start: periodStart,
          period_end: periodEnd,
          context_hash: expHash,
          prompt_version: PROMPT_VERSION,
          response,
        },
        { onConflict: 'user_id,feature,period_type,period_start,period_end' },
      )
      if (upErr) console.error('stelar-insight: cache upsert failed (experimento)', upErr.message)
      return json({ ...response, cached: false })
    }

    const spanDays = Math.max(
      0,
      Math.round(
        (new Date(`${periodEnd}T00:00:00Z`).getTime() -
          new Date(`${periodStart}T00:00:00Z`).getTime()) /
          86400000,
      ),
    )
    const prevEnd = shiftDate(periodStart, -1)
    const prevStart = shiftDate(prevEnd, -spanDays)

    const [curRes, prevRes, macrosRes] = await Promise.all([
      supabase
        .from('daily_signals')
        .select('*')
        .gte('day', periodStart)
        .lte('day', periodEnd)
        .order('day', { ascending: true }),
      supabase.from('daily_signals').select('*').gte('day', prevStart).lte('day', prevEnd),
      supabase.from('macro_targets').select('calories').maybeSingle(),
    ])
    if (curRes.error) throw curRes.error

    const calorieTarget = macrosRes.data?.calories ?? null
    const context = buildPeriodContext({
      period: periodType,
      signals: dedupeByDay(curRes.data ?? []),
      calorieTarget,
      previous: dedupeByDay(prevRes.data ?? []),
    })
    const contextHash = hashContext(context)

    const { data: cached } = await supabase
      .from('ai_insights')
      .select('response, context_hash, prompt_version, expires_at')
      .eq('feature', feature)
      .eq('period_type', periodType)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .maybeSingle()

    const fresh =
      cached &&
      cached.context_hash === contextHash &&
      cached.prompt_version === PROMPT_VERSION &&
      (cached.expires_at == null || new Date(cached.expires_at).getTime() > Date.now())
    if (fresh) return json({ ...cached.response, cached: true })

    const { system, user } = buildInsightPrompt(context, insights)
    const voz = await generateVoz(system, user, openaiKey)
    if (!voz) return json({ error: 'No pudimos leer tu voz ahora.' }, 502)

    const { error: upsertErr } = await supabase.from('ai_insights').upsert(
      {
        user_id: userId,
        feature,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        context_hash: contextHash,
        prompt_version: PROMPT_VERSION,
        response: voz,
      },
      { onConflict: 'user_id,feature,period_type,period_start,period_end' },
    )
    if (upsertErr) console.error('stelar-insight: cache upsert failed', upsertErr.message)

    return json({ ...voz, cached: false })
  } catch (err) {
    console.error('[stelar-insight]', err instanceof Error ? err.message : String(err))
    return json({ error: 'No pudimos leer tu voz ahora.' }, 500)
  }
})
