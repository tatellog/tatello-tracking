// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: compute-findings
//
// El WRITER del Findings Engine (Epic 01 · F2 · T2.4). On-read-miss: la usuaria
// abre Órbita → esta fn lee SUS daily_signals + macro_targets + month_reflections
// (RLS-scoped con su JWT, sin service role), corre EL MISMO buildFindings que el
// cliente (_shared/intelligence/findings.ts) y hace UPSERT en `findings` (columnas
// de consulta + payload con el Finding completo), luego devuelve los hallazgos.
//
// La IA no participa: 100% determinístico. Ver docs/adr/0001-*.
//
// SEGURIDAD: JWT del caller → client RLS-scoped. No service role. Inputs con Zod.
// Errores cálidos y genéricos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

import { buildFindings } from '../_shared/intelligence/findings'
import { buildStories } from '../_shared/intelligence/stories'

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

const RequestSchema = z
  .object({
    period: z.enum(['day', 'week', 'month', 'last30']),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((r) => r.periodStart <= r.periodEnd, { message: 'periodStart > periodEnd' })

function dedupeByDay(rows) {
  const byDay = new Map()
  for (const r of rows ?? []) {
    if (r?.day == null) continue
    byDay.set(r.day, r)
  }
  return [...byDay.values()]
}

// Reflexiones de meses ANTERIORES (la más reciente por pregunta) — mismo criterio
// que features/orbit/reflections.ts fetchPriorReflections.
function buildPrior(rows, currentMonth: string) {
  const out: Record<string, { month: string; answer: string }> = {}
  for (const row of rows ?? []) {
    if (!row?.month || row.month >= currentMonth) continue
    if (!out[row.question_key]) out[row.question_key] = { month: row.month, answer: row.answer }
  }
  return out
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado.' }, 401)

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
    const { period, periodStart, periodEnd } = parsed.data
    const currentMonth = periodStart.slice(0, 7)

    // Datos del periodo (RLS-scoped). month_reflections desc → prior más reciente.
    const [signalsRes, macrosRes, reflRes] = await Promise.all([
      supabase
        .from('daily_signals')
        .select('*')
        .gte('day', periodStart)
        .lte('day', periodEnd)
        .order('day', { ascending: true }),
      supabase.from('macro_targets').select('calories, protein_g').maybeSingle(),
      supabase
        .from('month_reflections')
        .select('month, question_key, answer')
        .lt('month', currentMonth)
        .order('month', { ascending: false }),
    ])
    if (signalsRes.error) throw signalsRes.error

    const findings = buildFindings(
      dedupeByDay(signalsRes.data),
      {
        calorieTarget: macrosRes.data?.calories ?? null,
        proteinTarget: macrosRes.data?.protein_g ?? null,
      },
      buildPrior(reflRes.data, currentMonth),
    )
    // Story Engine (F3) plegado: historias derivadas de los hallazgos.
    const stories = buildStories(findings)

    // Persistir hallazgos (idempotente por unique(user, period, finding_id)):
    // columnas de consulta (R6) + payload con el Finding completo.
    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        user_id: userId,
        period_type: period,
        period_start: periodStart,
        period_end: periodEnd,
        finding_id: f.id,
        category: f.category,
        is_obstacle: f.isObstacle ?? false,
        confidence: f.confidence,
        subject: f.subject,
        payload: f,
      }))
      const { error: upErr } = await supabase
        .from('findings')
        .upsert(rows, { onConflict: 'user_id,period_type,period_start,period_end,finding_id' })
      if (upErr) console.error('compute-findings: findings upsert failed', upErr.message)
    }

    // Persistir historias (idempotente por unique(user, period, story_id)).
    if (stories.length > 0) {
      const storyRows = stories.map((s) => ({
        user_id: userId,
        period_type: period,
        period_start: periodStart,
        period_end: periodEnd,
        story_id: s.id,
        finding_ids: s.findingIds,
        chain: s.chain,
        score: s.score,
      }))
      const { error: sErr } = await supabase
        .from('stories')
        .upsert(storyRows, { onConflict: 'user_id,period_type,period_start,period_end,story_id' })
      if (sErr) console.error('compute-findings: stories upsert failed', sErr.message)
    }

    return json({ findings, stories })
  } catch (err) {
    console.error('[compute-findings]', err instanceof Error ? err.message : String(err))
    return json({ error: 'No pudimos calcular tus hallazgos ahora.' }, 500)
  }
})
