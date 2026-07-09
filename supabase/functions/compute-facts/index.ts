// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: compute-facts
//
// El WRITER del Facts Engine (Epic 01 · F1 · T1.3). On-read-miss: la usuaria
// abre Órbita → esta fn lee SUS daily_signals + macro_targets (RLS-scoped con su
// JWT, sin service role), corre el motor determinístico compartido
// (computeFacts, _shared/intelligence/facts.ts) y hace UPSERT en `facts`, luego
// devuelve los hechos. El cliente los lee de aquí (con fallback a compute).
//
// La IA no participa: esto es 100% determinístico. Ver docs/adr/0001-*.
//
// SEGURIDAD: JWT del caller → client RLS-scoped. No service role. Inputs con Zod.
// Errores cálidos y genéricos; nunca se filtran strings crudos de la DB.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

import { computeFacts } from '../_shared/intelligence/facts'

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

// Una fila por día (la view puede traer duplicados en ventanas abiertas).
function dedupeByDay(rows) {
  const byDay = new Map()
  for (const r of rows ?? []) {
    if (r?.day == null) continue
    byDay.set(r.day, r)
  }
  return [...byDay.values()]
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

    // Datos del periodo (RLS-scoped: solo los de la usuaria).
    const [signalsRes, macrosRes] = await Promise.all([
      supabase
        .from('daily_signals')
        .select('*')
        .gte('day', periodStart)
        .lte('day', periodEnd)
        .order('day', { ascending: true }),
      supabase.from('macro_targets').select('calories').maybeSingle(),
    ])
    if (signalsRes.error) throw signalsRes.error

    const calorieTarget = macrosRes.data?.calories ?? null
    const facts = computeFacts({
      period,
      periodStart,
      periodEnd,
      signals: dedupeByDay(signalsRes.data),
      calorieTarget,
    })

    // Persistir (idempotente por unique(user, period, kind)). El writer con el
    // JWT de la usuaria puede insertar/actualizar SUS filas (RLS insert/update).
    if (facts.length > 0) {
      const rows = facts.map((f) => ({
        user_id: userId,
        period_type: period,
        period_start: periodStart,
        period_end: periodEnd,
        kind: f.kind,
        value: f.value,
        unit: f.unit ?? null,
        evidence_count: f.evidenceCount,
      }))
      const { error: upErr } = await supabase
        .from('facts')
        .upsert(rows, { onConflict: 'user_id,period_type,period_start,period_end,kind' })
      if (upErr) console.error('compute-facts: upsert failed', upErr.message)
    }

    return json({ facts })
  } catch (err) {
    console.error('[compute-facts]', err instanceof Error ? err.message : String(err))
    return json({ error: 'No pudimos calcular tus hechos ahora.' }, 500)
  }
})
