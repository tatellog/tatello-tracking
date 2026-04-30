/*
 * Seed del usuario de desarrollo.
 *
 * Uso:
 *   pnpm seed:dev          → reset estándar: profile onboarding limpio
 *                             + 14 workouts + 2 measurements + 3 meals
 *                             + macro_targets. Para iterar el Home
 *                             "vivo" con historia.
 *   pnpm seed:dev --fresh  → user 100% virgen: SIN workouts, SIN
 *                             measurements, SIN meals, SIN macros, SIN
 *                             fotos, profile onboarding fields todos
 *                             null. Para testear el wizard + Día 1
 *                             como first-time user.
 *
 * Después de --fresh, en la app:
 *   - El route guard mandará a /onboarding/welcome.
 *   - AsyncStorage `@app:visited_day_one` puede quedar stale; no
 *     importa porque el onboarding gate gana antes que el Día 1 gate.
 *
 * Requiere en `.env.local` (NO se commitea):
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role, bypassea RLS
 *   DEV_USER_ID=<uuid del user dev@local.test>
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

const FRESH = process.argv.includes('--fresh')

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seed(): Promise<void> {
  console.log(`[seed] Resetting data for ${devUserId}${FRESH ? ' (--fresh: virgin user)' : ''}`)

  // Wipe everything that's per-user. Even in non-fresh mode we clear
  // photos because (a) they're sensitive and (b) the onboarding flow
  // re-uploads them; leftovers from prior runs would shadow the test.
  await Promise.all([
    supabase.from('workouts').delete().eq('user_id', devUserId),
    supabase.from('meals').delete().eq('user_id', devUserId),
    supabase.from('body_measurements').delete().eq('user_id', devUserId),
    supabase.from('mood_checkins').delete().eq('user_id', devUserId),
    supabase.from('macro_targets').delete().eq('user_id', devUserId),
    supabase.from('photos').delete().eq('user_id', devUserId),
  ])

  // Also remove storage objects for this user — RLS guards reads but
  // the metadata table being clean while the bucket has stale files
  // would orphan bytes.
  const { data: storageList } = await supabase.storage
    .from('progress-photos')
    .list(devUserId, { limit: 1000 })
  if (storageList && storageList.length > 0) {
    const paths = storageList.map((f) => `${devUserId}/${f.name}`)
    await supabase.storage.from('progress-photos').remove(paths)
    console.log(`[seed] Removed ${paths.length} stored photos`)
  }

  // Reset profile onboarding fields. The handle_new_user trigger
  // created the row originally; we just patch the wizard-collected
  // columns back to null so the route guard sends the user through
  // onboarding again.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      display_name: null,
      goal: null,
      date_of_birth: null,
      biological_sex: null,
      height_cm: null,
      onboarding_completed_at: null,
      first_workout_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', devUserId)
  if (profileErr) throw profileErr

  if (FRESH) {
    console.log('[seed] Done (fresh):')
    console.log('  • profile onboarding fields = null')
    console.log('  • workouts / meals / measurements / macros / photos = empty')
    console.log('  • app should route to /onboarding/welcome on next open')
    return
  }

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

  // The first_workout_at trigger only fires on inserts — but it does
  // fire on these. Unconditionally backfill it to the oldest workout
  // so the home doesn't sit in first-day mode for a dev user that
  // already has 14 days of history.
  const oldest = workouts[workouts.length - 1]?.completed_at
  if (oldest) {
    const { error: backfillErr } = await supabase
      .from('profiles')
      .update({
        first_workout_at: oldest,
        // The standard seed user has finished onboarding so the route
        // guard sends them straight to /(tabs).
        onboarding_completed_at: new Date().toISOString(),
        display_name: 'Dev',
        date_of_birth: '1995-01-01',
        biological_sex: 'female',
        height_cm: 165,
        goal: 'recomposition',
      })
      .eq('id', devUserId)
    if (backfillErr) throw backfillErr
  }

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
  console.log('  • profile onboarded (Dev, female, 165 cm, 1995-01-01, recomposition)')
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
