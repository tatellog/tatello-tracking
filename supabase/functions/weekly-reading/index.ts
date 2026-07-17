// @ts-nocheck — typechecked by Deno (deno.json), not the app tsconfig.
// Edge function: weekly-reading
//
// El WRITER de la Lectura Semanal (roadmap V-05). On-read-miss: la usuaria
// abre la lectura → esta fn calcula la última semana CERRADA con EL MISMO
// buildWeeklyReading que corre el cliente (_shared/intelligence/
// weekly-reading.ts), la inserta en `weekly_readings` (inmutable: si ya
// existe, devuelve la guardada tal cual) y la regresa.
//
// La IA no participa: 100% determinístico.
//
// SEGURIDAD: JWT del caller → client RLS-scoped. No service role. Inputs
// con Zod. Errores cálidos y genéricos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.23.8'

import { buildWeeklyReading, lastClosedWeekStart } from '../_shared/intelligence/weekly-reading.ts'

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

// El "hoy" LOCAL de la usuaria viaja del cliente (el server no conoce su
// timezone; regla del repo: America/Mexico_City vive en el cliente).
// action 'get' = leer/generar (default) · 'open' = marcar opened_at (la
// métrica "Insights Opened per Week"), único campo mutable de la fila.
const RequestSchema = z.object({
  todayIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(['get', 'open']).default('get'),
})

function isoAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n, 12)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${dd}`
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

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
    const { todayIso, action } = parsed.data

    const weekStart = lastClosedWeekStart(todayIso)
    const weekEnd = isoAddDays(weekStart, 6)

    if (action === 'open') {
      const { error: openErr } = await supabase
        .from('weekly_readings')
        .update({ opened_at: new Date().toISOString() })
        .eq('week_start', weekStart)
        .is('opened_at', null)
      if (openErr) throw openErr
      return json({ ok: true })
    }

    // Inmutable: si la lectura de esa semana ya existe, se devuelve tal
    // cual — jamás se recalcula (lo histórico no retrocede).
    const existing = await supabase
      .from('weekly_readings')
      .select('payload, opened_at')
      .eq('week_start', weekStart)
      .maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) {
      return json({ reading: existing.data.payload, openedAt: existing.data.opened_at })
    }

    // Señales: la ventana del TDEE son 28 días cerrados antes del lunes
    // siguiente; 42 días de margen cubren racimos de pesajes y la semana.
    const [signalsRes, macrosRes] = await Promise.all([
      supabase
        .from('daily_signals')
        .select('*')
        .gte('day', isoAddDays(weekStart, -42))
        .lte('day', weekEnd)
        .order('day', { ascending: true }),
      supabase.from('macro_targets').select('calories, protein_g').maybeSingle(),
    ])
    if (signalsRes.error) throw signalsRes.error

    const reading = buildWeeklyReading(signalsRes.data ?? [], weekStart, {
      calorieTarget: macrosRes.data?.calories ?? null,
      proteinTarget: macrosRes.data?.protein_g ?? null,
    })

    // Silencio honesto: sin datos suficientes no se guarda nada (si la
    // semana se completa por backfill, la lectura podrá nacer después).
    if (!reading) return json({ reading: null, openedAt: null })

    const inserted = await supabase
      .from('weekly_readings')
      .insert({
        user_id: userId,
        week_start: weekStart,
        grade: reading.grade,
        payload: reading,
      })
      .select('payload, opened_at')
      .maybeSingle()
    // Carrera benigna (dos aperturas simultáneas): el unique gana; se
    // devuelve la calculada — idéntica, es determinística.
    if (inserted.error && inserted.error.code !== '23505') throw inserted.error

    return json({ reading, openedAt: null })
  } catch (e) {
    console.error('weekly-reading: unhandled', e instanceof Error ? e.message : String(e))
    return json({ error: 'Tu lectura no está disponible ahora. Intenta más tarde.' }, 500)
  }
})
