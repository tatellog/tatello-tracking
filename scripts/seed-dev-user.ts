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

  // 14 days of workouts with ~80% probability per day. Yesterday is
  // forced to true so today's TodayTile lands "in streak" and the
  // user has continuity with their last session. Today is left blank
  // intentionally so the tile appears for tap-to-mark testing.
  const today = new Date()
  const workouts: { user_id: string; completed_at: string; type: string }[] = []
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    d.setHours(18, 0, 0, 0)
    const isInStreak = i === 1 || Math.random() > 0.2
    if (isInStreak) {
      workouts.push({
        user_id: devUserId,
        completed_at: d.toISOString(),
        type: 'gym',
      })
    }
  }
  const { error: workoutsErr } = await supabase.from('workouts').insert(workouts)
  if (workoutsErr) throw workoutsErr

  // Backfill first_workout_at + complete onboarding so the route
  // guard sends the seeded user straight to /(tabs).
  const oldestWorkout = workouts[workouts.length - 1]?.completed_at
  if (oldestWorkout) {
    const { error: backfillErr } = await supabase
      .from('profiles')
      .update({
        first_workout_at: oldestWorkout,
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

  // 14 days of meals. RECETARIO seeds the "Lo de ayer" pattern: the
  // most recent dinner is "Pollo con arroz y verduras", which the
  // suggestion RPC (Bloque 4) latches onto. Variety in lunches and
  // breakfasts keeps the meals tab visually realistic.
  const RECETARIO = {
    breakfast: [
      { name: 'Avena con plátano', protein_g: 18, calories: 380 },
      { name: 'Yogurt griego con almendras', protein_g: 22, calories: 320 },
      { name: 'Huevos con aguacate', protein_g: 24, calories: 420 },
    ],
    lunch: [
      { name: 'Pollo con arroz y verduras', protein_g: 40, calories: 520 },
      { name: 'Salmón con quinoa', protein_g: 38, calories: 480 },
      { name: 'Tacos de pescado', protein_g: 32, calories: 620 },
    ],
    dinner: [
      // Yesterday's dinner is always the first entry — drives the
      // "Lo de ayer" suggestion in the redesigned log screen.
      { name: 'Pollo con arroz y verduras', protein_g: 40, calories: 520 },
      { name: 'Ensalada con atún', protein_g: 35, calories: 380 },
    ],
  } as const

  const meals: {
    user_id: string
    consumed_at: string
    name: string
    protein_g: number
    calories: number
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    source: string
  }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)

    // Skip today's breakfast/lunch/dinner so the user can log fresh
    // entries for "today". Yesterday and earlier get full days.
    if (i === 0) continue

    const breakfast = RECETARIO.breakfast[i % RECETARIO.breakfast.length]!
    const bDate = new Date(d)
    bDate.setHours(8, 30, 0, 0)
    meals.push({
      user_id: devUserId,
      consumed_at: bDate.toISOString(),
      ...breakfast,
      meal_type: 'breakfast',
      source: 'manual',
    })

    const lunch = RECETARIO.lunch[i % RECETARIO.lunch.length]!
    const lDate = new Date(d)
    lDate.setHours(14, 0, 0, 0)
    meals.push({
      user_id: devUserId,
      consumed_at: lDate.toISOString(),
      ...lunch,
      meal_type: 'lunch',
      source: 'manual',
    })

    // Yesterday (i === 1) is locked to "Pollo con arroz" to seed the
    // suggestion. Other days alternate freely.
    const dinner = i === 1 ? RECETARIO.dinner[0]! : RECETARIO.dinner[i % RECETARIO.dinner.length]!
    const dDate = new Date(d)
    dDate.setHours(19, 30, 0, 0)
    meals.push({
      user_id: devUserId,
      consumed_at: dDate.toISOString(),
      ...dinner,
      meal_type: 'dinner',
      source: 'manual',
    })
  }
  const { error: mealsErr } = await supabase.from('meals').insert(meals)
  if (mealsErr) throw mealsErr

  // 8 weekly body_measurements descending toward today, slow drift
  // -2 kg over 8 weeks plus a little jitter so the chart looks
  // realistic, not a straight line.
  const measurements: {
    user_id: string
    measured_at: string
    weight_kg: number
    waist_cm: number
  }[] = []
  for (let i = 0; i < 8; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    measurements.push({
      user_id: devUserId,
      measured_at: d.toISOString(),
      weight_kg: Number((76.2 + i * 0.3 + (Math.random() - 0.5) * 0.4).toFixed(2)),
      waist_cm: Number((74 + i * 0.25).toFixed(1)),
    })
  }
  const { error: measErr } = await supabase.from('body_measurements').insert(measurements)
  if (measErr) throw measErr

  console.log('[seed] Done:')
  console.log('  • profile onboarded (Dev, female, 165 cm, 1995-01-01, recomposition)')
  console.log(`  • ${workouts.length} workouts in last 14 days (yesterday locked in)`)
  console.log(`  • ${meals.length} meals across last 13 days (today empty)`)
  console.log(`  • ${measurements.length} weekly body_measurements over 8 weeks`)
  console.log('  • macro_targets: 130g protein / 1800 cal')
  console.log('  • yesterday\'s dinner = "Pollo con arroz y verduras" → suggestion RPC primed')
}

seed().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
