// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: daily-intelligence
//
// The deterministic órbita "engine" on the BACKEND. Reads the caller's
// own daily_signals + meals + macro_targets (RLS-scoped via the user's
// JWT) and runs the EXACT same rules the app used to run client-side —
// the shared single source in ../_shared/intelligence/. Returns a full
// payload the app renders: Día (dimensions + "cómo va tu día"), Semana
// (days, archetype, voz, "lo que repites", "lo que viene"), Mes (summary,
// theme, voz, satellites, recurring patterns).
//
// SECURITY MODEL
//   - The caller presents their anon-key JWT; we create a client bound to
//     it, so every query is RLS-scoped to that user. No service role.
//   - Inputs (today's local date, weekday, water goal) are validated with
//     Zod — those three can't be derived server-side (device timezone +
//     locally-stored water goal).
//   - Errors to the client are warm + generic; raw DB strings never leak.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

import { isCycleActive } from '../_shared/intelligence/cycle-gate'
import { computeIntelligence } from '../_shared/intelligence/index'

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

// today/weekday/water-goal come from the client (device timezone + local
// water goal aren't knowable server-side).
const RequestSchema = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  todayGetDay: z.number().int().min(0).max(6),
  waterGoalGlasses: z.number().int().min(1).max(40),
})

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

    const body = await req.json().catch(() => ({}))
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) return json({ error: 'Petición inválida.' }, 400)
    const { today, todayGetDay, waterGoalGlasses } = parsed.data

    // 35-day rolling window ending today — feeds patterns + month arc.
    const from = shiftDate(today, -34)
    const [signalsRes, mealsRes, macrosRes, profileRes] = await Promise.all([
      supabase
        .from('daily_signals')
        .select('*')
        .gte('day', from)
        .lte('day', today)
        .order('day', { ascending: true }),
      supabase.from('meals').select('consumed_at').gte('meal_date', from).lte('meal_date', today),
      supabase.from('macro_targets').select('calories, protein_g').maybeSingle(),
      // Gate de ciclo (cycle-gate.ts): derivado del perfil server-side, no
      // del request — el cliente no decide si tiene ciclo.
      supabase.from('profiles').select('biological_sex, cycle_situation').maybeSingle(),
    ])
    if (signalsRes.error) throw signalsRes.error

    const intelligence = computeIntelligence({
      history: signalsRes.data ?? [],
      meals: mealsRes.data ?? [],
      today,
      todayGetDay,
      calorieTarget: macrosRes.data?.calories ?? null,
      proteinTarget: macrosRes.data?.protein_g ?? null,
      waterGoalGlasses,
      cycleEnabled: isCycleActive(
        profileRes.data?.biological_sex,
        profileRes.data?.cycle_situation,
      ),
    })

    return json(intelligence)
  } catch (err) {
    console.error('[daily-intelligence]', err)
    return json({ error: 'No pudimos leer tu día ahora mismo.' }, 500)
  }
})
