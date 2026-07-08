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
// actualizar esta copia. Se mantiene byte-por-byte la misma lógica (los
// tests de _shared la cubren).
//
// SECURITY: JWT del caller → client RLS-scoped. No service role. La
// OPENAI_API_KEY vive solo como secret. Errores cálidos y genéricos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

const MODEL = 'gpt-4o-mini'
const PROMPT_VERSION = 'v1'
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

/* ── request / response ──────────────────────────────────────────────── */
const RequestSchema = z.object({
  feature: z.enum(['orbita_dia', 'orbita_semana', 'orbita_mes', 'progreso']),
  periodType: z.enum(['day', 'week', 'month', 'last30']),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  insights: z.array(z.string().max(200)).max(8).optional(),
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
    const { feature, periodType, periodStart, periodEnd, insights } = parsed.data

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
