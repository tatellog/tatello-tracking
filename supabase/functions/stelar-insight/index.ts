// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: stelar-insight
//
// La capa de VOZ del AI Foundation (docs/ai-foundation-spec.md · paso 5).
// Orquesta: lee las señales del periodo (RLS-scoped) → Context Engine
// (server, mismas reglas que el cliente) → context_hash → CACHÉ. Solo si el
// hash cambió (o el prompt_version) llama a gpt-4o-mini para EXPLICAR el
// contexto; la respuesta se guarda en ai_insights. La IA nunca ve registros
// raw, nunca detecta el patrón (eso ya lo hizo el backend).
//
// SECURITY MODEL
//   - JWT del caller → client RLS-scoped. No service role. La OPENAI_API_KEY
//     vive solo como secret. Errores cálidos y genéricos al cliente.
//   - Coste: el caché evita re-llamar la IA cuando nada cambió (regla del
//     release). Modelo en una constante → agnóstico de proveedor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

import { buildPeriodContext } from '../_shared/intelligence/context'
import { hashContext } from '../_shared/intelligence/context-hash'
import { buildInsightPrompt, PROMPT_VERSION } from '../_shared/intelligence/prompt-builder'

const MODEL = 'gpt-4o-mini'

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

const RequestSchema = z.object({
  feature: z.enum(['orbita_dia', 'orbita_semana', 'orbita_mes', 'progreso']),
  periodType: z.enum(['day', 'week', 'month', 'last30']),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Hallazgos determinísticos ya detectados por el cliente (frases planas).
  // La IA los explica; opcional (sin ellos explica solo el contexto).
  insights: z.array(z.string().max(200)).max(8).optional(),
})

// Contrato de salida del modelo = VozParte[] (la estructura de voz existente).
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

/** Una fila por día (defensa contra un posible fan-out de la view). */
function dedupeByDay(rows: { day: string | null }[]): any[] {
  const byDay = new Map<string, any>()
  for (const r of rows) {
    if (r.day == null) continue
    byDay.set(r.day, r) // la última gana; da igual, son iguales por día
  }
  return [...byDay.values()]
}

/** Llama a gpt-4o-mini y devuelve el VozParte validado, o null si algo falla
 *  (la app mapea null a un fallback silencioso). */
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
  let raw: unknown
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

    // Periodo anterior de la misma longitud (para la comparación).
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

    // CACHÉ: si existe una fila para (usuaria, feature, periodo) con el mismo
    // hash y prompt_version, y no venció → se sirve sin llamar a la IA.
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
    if (fresh) {
      return json({ ...cached.response, cached: true })
    }

    // Nada fresco → construir prompt y llamar a la IA.
    const { system, user } = buildInsightPrompt({ feature, context, insights })
    const voz = await generateVoz(system, user, openaiKey)
    if (!voz) return json({ error: 'No pudimos leer tu voz ahora.' }, 502)

    // Guardar en el caché (upsert por la unique (user, feature, periodo)).
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
