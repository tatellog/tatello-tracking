/*
 * Seed del usuario de desarrollo.
 *
 * Uso:
 *   pnpm seed:dev
 *
 * Requiere en `.env.local` (NO se commitea):
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role, bypassea RLS
 *   DEV_USER_ID=<uuid del user dev@local.test>
 *
 * Resultado tras ejecutar:
 *   - 14 workouts (ayer hasta hace 14 días — HOY queda libre para
 *     que el tile gigante aparezca)
 *   - 2 measurements (78kg / 76cm hace 30 días, 76.2kg / 74cm hoy)
 *   - 3 meals de hoy: 85g proteína, 1470 cal
 *   - macro_targets: 130g proteína, 1800 cal
 *
 * Es idempotente: borra primero la data del dev user y vuelve a
 * insertar. No toca otros users.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const devUserId = process.env.DEV_USER_ID

if (!url || !serviceKey || !devUserId) {
  console.error(
    'Faltan envs en .env.local:\n' +
      '  EXPO_PUBLIC_SUPABASE_URL\n' +
      '  SUPABASE_SERVICE_ROLE_KEY\n' +
      '  DEV_USER_ID',
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seed(): Promise<void> {
  console.log(`[seed] Resetting data for ${devUserId}`)

  await Promise.all([
    supabase.from('workouts').delete().eq('user_id', devUserId),
    supabase.from('meals').delete().eq('user_id', devUserId),
    supabase.from('body_measurements').delete().eq('user_id', devUserId),
    supabase.from('mood_checkins').delete().eq('user_id', devUserId),
    supabase.from('macro_targets').delete().eq('user_id', devUserId),
  ])

  // Macro targets — needs to exist before the rings can render anything.
  const { error: targetsErr } = await supabase.from('macro_targets').insert({
    user_id: devUserId,
    protein_g: 130,
    calories: 1800,
  })
  if (targetsErr) throw targetsErr

  // 14 workouts: ayer hacia atrás (índice 1..14 días desde hoy). Hoy
  // queda intencionalmente libre para que el TodayTile aparezca.
  const workouts = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (i + 1))
    return {
      user_id: devUserId,
      completed_at: d.toISOString(),
      type: 'gym',
    }
  })
  const { error: workoutsErr } = await supabase.from('workouts').insert(workouts)
  if (workoutsErr) throw workoutsErr

  // 2 medidas: una hace 30 días, otra hoy.
  const today = new Date()
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const { error: measErr } = await supabase.from('body_measurements').insert([
    {
      user_id: devUserId,
      measured_at: thirtyAgo.toISOString(),
      weight_kg: 78.0,
      waist_cm: 76,
    },
    {
      user_id: devUserId,
      measured_at: today.toISOString(),
      weight_kg: 76.2,
      waist_cm: 74,
    },
  ])
  if (measErr) throw measErr

  // 3 comidas de hoy a horas razonables. Total: 85g proteína, 1470 cal.
  const morning = atHour(8, 30)
  const lunch = atHour(14, 0)
  const snack = atHour(17, 0)

  const { error: mealsErr } = await supabase.from('meals').insert([
    {
      user_id: devUserId,
      consumed_at: morning.toISOString(),
      name: 'Avena con plátano y proteína',
      protein_g: 35,
      calories: 450,
      source: 'manual',
    },
    {
      user_id: devUserId,
      consumed_at: lunch.toISOString(),
      name: 'Pollo con arroz y verduras',
      protein_g: 40,
      calories: 700,
      source: 'manual',
    },
    {
      user_id: devUserId,
      consumed_at: snack.toISOString(),
      name: 'Yogurt griego con nueces',
      protein_g: 10,
      calories: 320,
      source: 'manual',
    },
  ])
  if (mealsErr) throw mealsErr

  console.log('[seed] Done:')
  console.log('  • 14 workouts (yesterday and 13 prior days)')
  console.log('  • 2 measurements (today 76.2 kg, 30d ago 78.0 kg)')
  console.log('  • 3 meals today (85g protein, 1470 cal)')
  console.log('  • macro_targets: 130g protein / 1800 cal')
}

function atHour(h: number, m: number): Date {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

seed().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
