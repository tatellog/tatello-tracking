// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: experiment-lifecycle
//
// El WRITER del ciclo de vida de Experiments (Epic 05 · F-A · T-A2). Dos
// acciones sobre el JWT de la usuaria (RLS-scoped, SIN service role):
//
//   · start: convierte una HIPÓTESIS en un experimento activo. Resuelve el
//     Finding fuente (para la dimensión), arma el scaffold medible
//     (buildExperimentScaffold), calcula la LÍNEA BASE de esa métrica con los 30
//     días previos (computeMetricRate) e inserta el experimento (status
//     'running'). El índice único parcial de la DB garantiza ≤1 activo: un
//     segundo start rebota (409). Luego marca la hipótesis 'experimenting'.
//
//   · close: mide el experimento (measureExperiment sobre daily_signals de la
//     ventana vs la línea base) y escribe el RESULTADO
//     (confirmed/discarded/inconclusive) en el experimento + espeja el status en
//     la hipótesis. EL MOTOR decide; la IA no participa.
//
// `experiments` es la FUENTE DE VERDAD del "activo"; `hypotheses.status` es un
// mirror denormalizado que se actualiza best-effort (su desajuste no rompe el
// invariante, que lo protege la DB).
//
// SEGURIDAD: JWT del caller → client RLS-scoped. No service role. Zod en inputs.
// Errores cálidos y genéricos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

import {
  buildExperimentScaffold,
  computeMetricRate,
  measureExperiment,
} from '../_shared/intelligence/experiments'

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

const DAY = /^\d{4}-\d{2}-\d{2}$/
const RequestSchema = z.union([
  z.object({
    action: z.literal('start'),
    hypothesisId: z.string().uuid(),
    today: z.string().regex(DAY),
  }),
  z.object({
    action: z.literal('close'),
    experimentId: z.string().uuid(),
    today: z.string().regex(DAY),
  }),
])

/** today + n días, en ISO 'YYYY-MM-DD' (UTC, sin librería). */
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

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

    const macros = await supabase.from('macro_targets').select('calories, protein_g').maybeSingle()
    const ctx = {
      calorieTarget: macros.data?.calories ?? null,
      proteinTarget: macros.data?.protein_g ?? null,
    }

    if (parsed.data.action === 'start') return await start(supabase, userId, parsed.data, ctx)
    return await close(supabase, userId, parsed.data, ctx)
  } catch (err) {
    console.error('[experiment-lifecycle]', err instanceof Error ? err.message : String(err))
    return json({ error: 'No pudimos actualizar tu experimento ahora.' }, 500)
  }
})

async function start(supabase, userId: string, body, ctx) {
  const { hypothesisId, today } = body

  // Auto-cerrar un experimento VENCIDO antes de arrancar otro: sin cron, un
  // activo que ya pasó su ends_on bloquearía el único slot para siempre (#13).
  // Si el activo aún no vence, rebota claro (409) sin hacer el trabajo de abajo.
  const { data: active } = await supabase
    .from('experiments')
    .select('*')
    .eq('status', 'running')
    .maybeSingle()
  if (active) {
    if (active.ends_on < today) {
      await measureAndClose(supabase, active, today, ctx)
    } else {
      return json({ error: 'Ya tienes un experimento activo.' }, 409)
    }
  }

  // La hipótesis (RLS: solo la propia). Debe seguir 'open': una hipótesis se
  // experimenta UNA vez; no re-pisamos un resultado ya registrado (#2).
  const { data: hyp, error: hErr } = await supabase
    .from('hypotheses')
    .select('id, status, period_type, period_start, period_end, source_finding_id, source_story_id')
    .eq('id', hypothesisId)
    .maybeSingle()
  if (hErr) throw hErr
  if (!hyp) return json({ error: 'No encontramos esa hipótesis.' }, 404)
  if (hyp.status !== 'open') return json({ error: 'Esta hipótesis ya tuvo su experimento.' }, 409)

  // Resolver el finding_id (slug) fuente: directo, o el primero de la historia.
  let sourceFindingSlug: string | null = hyp.source_finding_id ?? null
  if (!sourceFindingSlug && hyp.source_story_id) {
    const { data: story } = await supabase
      .from('stories')
      .select('finding_ids')
      .eq('story_id', hyp.source_story_id)
      .eq('period_type', hyp.period_type)
      .eq('period_start', hyp.period_start)
      .eq('period_end', hyp.period_end)
      .maybeSingle()
    sourceFindingSlug = story?.finding_ids?.[0] ?? null
  }
  if (!sourceFindingSlug)
    return json({ error: 'Esta hipótesis aún no puede volverse experimento.' }, 422)

  // El Finding fuente (misma ventana) → la dimensión.
  const { data: finding } = await supabase
    .from('findings')
    .select('finding_id, category')
    .eq('finding_id', sourceFindingSlug)
    .eq('period_type', hyp.period_type)
    .eq('period_start', hyp.period_start)
    .eq('period_end', hyp.period_end)
    .maybeSingle()
  if (!finding) return json({ error: 'Esta hipótesis aún no puede volverse experimento.' }, 422)

  const plan = buildExperimentScaffold(
    { id: hypothesisId, sourceFindingId: hyp.source_finding_id ?? undefined },
    { id: finding.finding_id, category: finding.category },
  )
  if (!plan) return json({ error: 'Esta dimensión no da un experimento medible.' }, 422)

  // Línea base: la tasa de esa métrica en los 30 días PREVIOS a hoy.
  const { data: priorRows } = await supabase
    .from('daily_signals')
    .select('*')
    .gte('day', addDays(today, -30))
    .lt('day', today)
    .order('day', { ascending: true })
  const baseline = computeMetricRate(plan.metric, dedupeByDay(priorRows), ctx)

  const endsOn = addDays(today, plan.durationDays)
  const { data: created, error: insErr } = await supabase
    .from('experiments')
    .insert({
      user_id: userId,
      hypothesis_id: hypothesisId,
      dimension: plan.dimension,
      status: 'running',
      started_on: today,
      ends_on: endsOn,
      // Guardamos también el tamaño de la base para que el cierre pueda exigir
      // muestra suficiente antes de dar un veredicto (#1).
      plan: { ...plan, baselineRate: baseline.rate, baselineDaysMeasured: baseline.daysMeasured },
    })
    .select()
    .single()
  if (insErr) {
    // 23505 = viola el índice único parcial → ya hay un activo.
    if (insErr.code === '23505') return json({ error: 'Ya tienes un experimento activo.' }, 409)
    throw insErr
  }

  // Mirror best-effort: la hipótesis pasa a 'experimenting'.
  const { error: updErr } = await supabase
    .from('hypotheses')
    .update({ status: 'experimenting' })
    .eq('id', hypothesisId)
  if (updErr) console.error('experiment-lifecycle: hypothesis mirror failed', updErr.message)

  return json({ experiment: created })
}

async function close(supabase, userId: string, body, ctx) {
  const { experimentId, today } = body

  const { data: exp, error: eErr } = await supabase
    .from('experiments')
    .select('*')
    .eq('id', experimentId)
    .maybeSingle()
  if (eErr) throw eErr
  if (!exp) return json({ error: 'No encontramos ese experimento.' }, 404)
  if (exp.status !== 'running') return json({ error: 'Ese experimento ya está cerrado.' }, 409)

  const result = await measureAndClose(supabase, exp, today, ctx)
  // null = otra llamada ganó la carrera y ya lo cerró entre el read y el update.
  if (!result) return json({ error: 'Ese experimento ya está cerrado.' }, 409)
  return json(result)
}

/**
 * Mide un experimento running y escribe su cierre (resultado + espejo en la
 * hipótesis). Idempotente por la guarda `.eq('status','running')`: si otra
 * llamada ya lo cerró, devuelve null en vez de pisar el resultado (#3). Lo usan
 * la acción `close` Y el auto-close de vencidos en `start` (#13).
 */
async function measureAndClose(supabase, exp, today: string, ctx) {
  const plan = exp.plan ?? {}
  // Ventana: de started_on hasta hoy (o hasta ends_on si ya pasó).
  const windowEnd = today < exp.ends_on ? today : exp.ends_on
  const { data: windowRows } = await supabase
    .from('daily_signals')
    .select('*')
    .gte('day', exp.started_on)
    .lte('day', windowEnd)
    .order('day', { ascending: true })

  const measurement = measureExperiment(
    { metric: plan.metric, direction: plan.direction, durationDays: plan.durationDays },
    dedupeByDay(windowRows),
    {
      baselineRate: plan.baselineRate ?? 0,
      baselineDaysMeasured: plan.baselineDaysMeasured,
      ...ctx,
    },
  )

  const { data: closed, error: updErr } = await supabase
    .from('experiments')
    .update({
      status: measurement.status,
      result: measurement,
      closed_at: new Date().toISOString(),
    })
    .eq('id', exp.id)
    .eq('status', 'running') // no cierra dos veces (carrera)
    .select()
    .maybeSingle()
  if (updErr) throw updErr
  if (!closed) return null // otra llamada ya lo cerró

  // Mirror best-effort: la hipótesis toma el resultado.
  const { error: hUpdErr } = await supabase
    .from('hypotheses')
    .update({ status: measurement.status })
    .eq('id', exp.hypothesis_id)
  if (hUpdErr) console.error('experiment-lifecycle: hypothesis mirror failed', hUpdErr.message)

  return { experiment: closed, measurement }
}
