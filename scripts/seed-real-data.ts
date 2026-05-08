/*
 * Seed real user data for the dev account.
 *
 * Source: two screenshots Tania shared on 2026-05-04 — a 9-day
 * tracking table covering 2026-04-23 to 2026-05-01, plus a body
 * composition history with 5 dated entries from 2024-08 to
 * 2026-04-24.
 *
 * Calorie / protein columns came as ranges (e.g. "1150-1350");
 * stored as midpoint integers since the schema is single-valued.
 * Comments + the food-pattern label go into meals.notes so the
 * source is preserved.
 *
 * Idempotent: wipes the dev user's workouts / meals / measurements /
 * macro_targets first, then re-inserts. Profile fields stay
 * untouched (use `pnpm seed:dev` for that side).
 *
 * Run with:
 *   pnpm tsx scripts/seed-real-data.ts
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

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type DayEntry = {
  /** YYYY-MM-DD (local). */
  date: string
  comida: string | null
  /** Midpoint of the calorie range, null if "sin datos". */
  calories: number | null
  /** Midpoint of the protein range, null if "sin datos". */
  protein_g: number | null
  ejercicio: string | null
  comentario: string
  /** What slot to log the meal under. Default lunch (Mexican comida). */
  meal_type: MealType
}

const TRACKING: DayEntry[] = [
  {
    date: '2026-04-23',
    comida: 'Controlado + proteína',
    calories: 1250,
    protein_g: 108,
    ejercicio: 'Fuerza + HIIT',
    comentario: 'Muy buen inicio',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-24',
    comida: 'Bistec + nopales',
    calories: 1200,
    protein_g: 110,
    ejercicio: 'Fuerza + cardio',
    comentario: 'Sólido',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-25',
    comida: null,
    calories: null,
    protein_g: null,
    ejercicio: null,
    comentario: 'Falta tracking',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-26',
    comida: 'Full body',
    calories: 1225,
    protein_g: 103,
    ejercicio: 'Full body + cardio',
    comentario: 'Bien',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-27',
    comida: 'Parcial',
    calories: 1250,
    protein_g: 98,
    ejercicio: 'Actividad',
    comentario: 'Variable',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-28',
    comida: 'Ensalada + yogurt + pechuga',
    calories: 1250,
    protein_g: 108,
    ejercicio: 'Activo',
    comentario: 'Muy bien',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-29',
    comida: 'Papas + ensalada + scoop',
    calories: 1025,
    protein_g: 78,
    ejercicio: 'Pasos',
    comentario: 'Proteína baja',
    meal_type: 'lunch',
  },
  {
    date: '2026-04-30',
    comida: 'Sándwich + ensalada + scoop',
    calories: 1115,
    protein_g: 100,
    ejercicio: 'Controlado',
    comentario: 'Bien',
    meal_type: 'lunch',
  },
  {
    date: '2026-05-01',
    comida: 'Buen desayuno',
    calories: 420,
    protein_g: 30,
    ejercicio: null,
    comentario: 'Buen inicio',
    meal_type: 'breakfast',
  },
]

type Composition = {
  /** YYYY-MM-DD anchor date. Set to mid-month for the older Ago/Nov/Oct/Feb columns. */
  date: string
  weight_kg: number
  bmi: number
  bmr: number
  water_pct: number
  bone_mass_kg: number
  metabolic_age: number
  visceral_fat: number
  muscle_mass_kg: number
  body_fat_pct: number
}

const COMPOSITION: Composition[] = [
  {
    date: '2024-08-15',
    weight_kg: 69.3,
    bmi: 24.2,
    bmr: 1374,
    water_pct: 47.9,
    bone_mass_kg: 2.3,
    metabolic_age: 47,
    visceral_fat: 4.5,
    muscle_mass_kg: 42.5,
    body_fat_pct: 35.4,
  },
  {
    date: '2024-11-15',
    weight_kg: 66.8,
    bmi: 22.8,
    bmr: 1392,
    water_pct: 51.0,
    bone_mass_kg: 2.3,
    metabolic_age: 36,
    visceral_fat: 3.5,
    muscle_mass_kg: 43.7,
    body_fat_pct: 31.1,
  },
  {
    date: '2025-10-15',
    weight_kg: 71.3,
    bmi: 24.7,
    bmr: 1421,
    water_pct: 48.5,
    bone_mass_kg: 2.4,
    metabolic_age: 46,
    visceral_fat: 4.5,
    muscle_mass_kg: 44.3,
    body_fat_pct: 34.6,
  },
  {
    date: '2026-02-15',
    weight_kg: 73.3,
    bmi: 25.4,
    bmr: 1387,
    water_pct: 45.3,
    bone_mass_kg: 2.3,
    metabolic_age: 58,
    visceral_fat: 5.5,
    muscle_mass_kg: 42.6,
    body_fat_pct: 38.8,
  },
  {
    date: '2026-04-24',
    weight_kg: 75.0,
    bmi: 26.0,
    bmr: 1462,
    water_pct: 49.5,
    bone_mass_kg: 3.4,
    metabolic_age: 37,
    visceral_fat: 10,
    muscle_mass_kg: 47.18,
    body_fat_pct: 32.5,
  },
]

function isoAt(date: string, hour: number, minute = 0): string {
  // Anchor to local Mexico City time then convert to UTC ISO. Avoids
  // the "Date-only string drifts to previous day" gotcha west of UTC.
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const local = new Date(y, m - 1, d, hour, minute, 0, 0)
  return local.toISOString()
}

async function seed(): Promise<void> {
  console.log(`[seed-real] Resetting workouts/meals/measurements/macros for ${devUserId}`)
  await Promise.all([
    supabase.from('workouts').delete().eq('user_id', devUserId),
    supabase.from('meals').delete().eq('user_id', devUserId),
    supabase.from('body_measurements').delete().eq('user_id', devUserId),
    supabase.from('macro_targets').delete().eq('user_id', devUserId),
  ])

  // Macros target — pulled from the upper edge of Tania's protein
  // range (95-120 g) and a 1300 kcal cap that lines up with her
  // tracking spread.
  const { error: targetsErr } = await supabase.from('macro_targets').insert({
    user_id: devUserId,
    protein_g: 110,
    calories: 1300,
  })
  if (targetsErr) throw targetsErr

  // Meals — one entry per day; the food pattern + comment go into
  // notes so context survives even though we squashed the daily
  // pattern into a single row.
  const meals = TRACKING.filter((d) => d.calories != null && d.protein_g != null).map((d) => ({
    user_id: devUserId,
    consumed_at: isoAt(d.date, d.meal_type === 'breakfast' ? 8 : 14, 30),
    name: d.comida ?? 'Sin nombre',
    protein_g: d.protein_g!,
    calories: d.calories!,
    meal_type: d.meal_type,
    source: 'manual',
    notes: `Patrón del día. Comentario: ${d.comentario}.`,
  }))
  const { error: mealsErr } = await supabase.from('meals').insert(meals)
  if (mealsErr) throw mealsErr

  // Workouts — one row per day with an exercise. Type carries the
  // exact label from the sheet (Fuerza + HIIT, Pasos, etc.) so we
  // can render it later without re-mapping.
  const workouts = TRACKING.filter((d) => d.ejercicio != null).map((d) => ({
    user_id: devUserId,
    completed_at: isoAt(d.date, 18, 0),
    type: d.ejercicio!,
    notes: d.comentario,
  }))
  const { error: workoutsErr } = await supabase.from('workouts').insert(workouts)
  if (workoutsErr) throw workoutsErr

  // Set first_workout_at to the oldest workout so the home doesn't
  // think we're in first-day mode.
  const oldestWorkout = workouts[0]?.completed_at
  if (oldestWorkout) {
    await supabase.from('profiles').update({ first_workout_at: oldestWorkout }).eq('id', devUserId)
  }

  // Composition — anchored to noon to keep timestamps unambiguous.
  const measurements = COMPOSITION.map((c) => ({
    user_id: devUserId,
    measured_at: isoAt(c.date, 12, 0),
    weight_kg: c.weight_kg,
    bmi: c.bmi,
    bmr: c.bmr,
    water_pct: c.water_pct,
    bone_mass_kg: c.bone_mass_kg,
    metabolic_age: c.metabolic_age,
    visceral_fat: c.visceral_fat,
    muscle_mass_kg: c.muscle_mass_kg,
    body_fat_pct: c.body_fat_pct,
  }))
  const { error: measErr } = await supabase.from('body_measurements').insert(measurements)
  if (measErr) throw measErr

  console.log('[seed-real] Done:')
  console.log(`  • macro_targets: 110 g protein / 1300 cal`)
  console.log(`  • ${meals.length} meals (1 per tracked day, midpoint values)`)
  console.log(`  • ${workouts.length} workouts (skipped Sábado + Viernes 1 May)`)
  console.log(`  • ${measurements.length} body_measurements (Ago 24 → Abr 24 2026)`)
  console.log(`  • profile.first_workout_at backfilled to ${oldestWorkout}`)
}

seed().catch((err) => {
  console.error('[seed-real] Failed:', err)
  process.exit(1)
})
