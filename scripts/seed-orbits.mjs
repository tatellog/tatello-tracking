/*
 * seed-orbits.mjs — populate a dedicated TEST user with 45 days of
 * correlated dummy data, so the órbita engine has real patterns to
 * detect before any capture UI exists.
 *
 *   node scripts/seed-orbits.mjs
 *
 * It is idempotent: it reuses the test user and wipes that user's rows
 * before re-inserting. It NEVER touches your real account.
 *
 * Baked-in correlations (this is the point — random data teaches the
 * engine nothing):
 *   · short sleep      → next-day low energy + low mood + high stress
 *   · period days      → lower energy, worse mood, higher stress
 *   · good energy      → more likely to train; training lifts mood
 *
 * The test user lives only in the DB. To SEE this data in the app,
 * sign in as the printed email/password.
 */
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

// ─── env ─────────────────────────────────────────────────────────────
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE_KEY) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')

const admin = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = 'seed@stelar.test'
const TEST_PASSWORD = 'test123'
const DAYS = 45
// Mexico City has been a permanent UTC-6 (no DST) since 2022, so a
// fixed offset is exact for this seed user's timezone.
const MX_OFFSET_H = 6

// ─── deterministic PRNG (mulberry32) — stable data across re-runs ────
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260518)

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

// Base "today" anchored to the seed date so the dataset is reproducible.
const BASE = Date.UTC(2026, 4, 18) // 2026-05-18 00:00 UTC

/** Local (Mexico City) calendar date `daysAgo` days before BASE. */
function localDate(daysAgo) {
  return new Date(BASE - daysAgo * 86400000).toISOString().slice(0, 10)
}

/** ISO UTC instant for a local Mexico City date + local hour (float;
 *  out-of-range hours roll into adjacent days, which is how a bedtime
 *  like 23.5 lands on the previous calendar day). */
function ts(dateStr, localHour) {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const hh = Math.floor(localHour)
  const mm = Math.round((localHour - hh) * 60)
  return new Date(Date.UTC(y, mo - 1, da, hh, mm) + MX_OFFSET_H * 3600000).toISOString()
}

function weekdayOf(dateStr) {
  const [y, mo, da] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, da)).getUTCDay() // 0 Sun … 6 Sat
}

// ─── menstrual cycle (28-day, two periods inside the window) ─────────
const PERIODS = [
  { start: '2026-04-08', end: '2026-04-12' },
  { start: '2026-05-06', end: '2026-05-10' },
]
function datesBetween(a, b) {
  const out = []
  for (let t = Date.parse(a); t <= Date.parse(b); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}
const periodDays = new Set(PERIODS.flatMap((p) => datesBetween(p.start, p.end)))
const pmsDays = new Set(
  PERIODS.flatMap((p) => [
    new Date(Date.parse(p.start) - 86400000).toISOString().slice(0, 10),
    new Date(Date.parse(p.start) - 2 * 86400000).toISOString().slice(0, 10),
  ]),
)

// ─── meal library ────────────────────────────────────────────────────
const MEALS = {
  breakfast: [
    { name: 'Avena con fruta', protein_g: 18, calories: 320 },
    { name: 'Huevos con aguacate', protein_g: 24, calories: 380 },
    { name: 'Yogurt griego con granola', protein_g: 22, calories: 290 },
    { name: 'Smoothie de proteína', protein_g: 30, calories: 260 },
  ],
  lunch: [
    { name: 'Pollo con arroz y verduras', protein_g: 42, calories: 560 },
    { name: 'Bowl de salmón', protein_g: 38, calories: 520 },
    { name: 'Pasta con atún', protein_g: 34, calories: 610 },
    { name: 'Ensalada con pollo', protein_g: 36, calories: 430 },
  ],
  dinner: [
    { name: 'Salmón con espárragos', protein_g: 40, calories: 470 },
    { name: 'Tacos de pescado', protein_g: 32, calories: 520 },
    { name: 'Sopa de verduras con pollo', protein_g: 30, calories: 360 },
    { name: 'Tofu salteado con quinoa', protein_g: 26, calories: 440 },
  ],
  snack: [
    { name: 'Manzana con crema de cacahuate', protein_g: 8, calories: 210 },
    { name: 'Barra de proteína', protein_g: 20, calories: 200 },
    { name: 'Puñado de almendras', protein_g: 7, calories: 170 },
  ],
}
const WORKOUT_TYPES = ['Pierna', 'Empuje', 'Jalón', 'Cardio', 'Full body']

// ─── find or create the test user ───────────────────────────────────
async function resolveTestUser() {
  const created = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (created.data?.user) return created.data.user.id
  // Already exists — look it up.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const found = data.users.find((u) => u.email === TEST_EMAIL)
  if (!found) throw new Error(`Could not create or find ${TEST_EMAIL}: ${created.error?.message}`)
  return found.id
}

async function insert(table, rows) {
  if (rows.length === 0) return
  const { error } = await admin.from(table).insert(rows)
  if (error) throw new Error(`insert ${table}: ${error.message}`)
}

async function main() {
  const userId = await resolveTestUser()
  console.log(`Test user: ${TEST_EMAIL}  (${userId})`)

  // Wipe this test user's rows so the script is re-runnable.
  const tables = [
    'sleep_logs',
    'wellbeing_checkins',
    'cycle_events',
    'mood_checkins',
    'meals',
    'workouts',
    'water_intake',
    'body_measurements',
  ]
  for (const t of tables) {
    const { error } = await admin.from(t).delete().eq('user_id', userId)
    if (error) throw new Error(`wipe ${t}: ${error.message}`)
  }

  // Profile + macro targets.
  await admin
    .from('profiles')
    .update({
      display_name: 'Seed Test',
      goal: 'recomposition',
      date_of_birth: '1995-08-14',
      biological_sex: 'female',
      height_cm: 165,
      timezone: 'America/Mexico_City',
      onboarding_completed_at: ts(localDate(DAYS - 1), 9),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  await admin.from('macro_targets').upsert({ user_id: userId, protein_g: 120, calories: 1900 })

  const sleep = []
  const wellbeing = []
  const moods = []
  const meals = []
  const workouts = []
  const water = []
  const measurements = []

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = localDate(d)
    const dow = weekdayOf(date)
    const weekend = dow === 0 || dow === 6
    const onPeriod = periodDays.has(date)
    const onPms = pmsDays.has(date)

    // ── sleep (drives the next day) ──────────────────────────────────
    let sleepHours = 6.5 + rand() * 1.0
    if (weekend) sleepHours += 0.8
    if (rand() < 0.16) sleepHours -= 1.7 // a scattered bad night
    sleepHours = clamp(sleepHours, 4.6, 9.2)
    const wakeHour = (weekend ? 8.0 : 6.7) + rand() * 0.9
    const quality = clamp(Math.round((sleepHours - 4) * 0.9 + (rand() - 0.5) * 0.8), 1, 5)
    sleep.push({
      user_id: userId,
      sleep_date: date,
      bedtime: ts(date, wakeHour - sleepHours),
      wake_time: ts(date, wakeHour),
      quality,
      notes: null,
    })

    // ── wellbeing — correlated with the night's sleep + cycle ────────
    const sleepEffect = (sleepHours - 7) * 0.85
    const periodEffect = onPeriod ? -1.25 : onPms ? -0.55 : 0
    const energy = clamp(
      Math.round(3.2 + sleepEffect + periodEffect + (weekend ? 0.2 : 0) + (rand() - 0.5) * 0.8),
      1,
      5,
    )
    const stress = clamp(
      Math.round(2.8 - sleepEffect * 0.7 + (onPeriod ? 1.0 : 0) + (rand() - 0.5) * 0.9),
      1,
      5,
    )

    // ── workout — likelier on high-energy days; lifts mood ───────────
    const trains = rand() < clamp(0.38 + (energy - 3) * 0.13 - (onPeriod ? 0.15 : 0), 0.05, 0.9)
    if (trains) {
      workouts.push({
        user_id: userId,
        completed_at: ts(date, 18 + rand() * 1.5),
        type: pick(WORKOUT_TYPES),
        notes: null,
      })
    }

    const motivation = clamp(
      Math.round(energy * 0.6 + 1.2 + (trains ? 0.4 : 0) + (rand() - 0.5) * 1.0),
      1,
      5,
    )
    wellbeing.push({
      user_id: userId,
      checked_at: ts(date, 21.3),
      checkin_date: date,
      energy,
      motivation,
      stress,
      notes: null,
    })

    // ── mood bucket — composite of energy, stress, training ──────────
    const moodScore = energy - (stress - 3) * 0.5 + (trains ? 0.4 : 0)
    moods.push({
      user_id: userId,
      value: moodScore >= 3.7 ? 'good' : moodScore >= 2.4 ? 'neutral' : 'struggle',
      checked_at: ts(date, 21.0),
    })

    // ── meals — 3 fixed + an occasional snack ────────────────────────
    const plan = [
      { slot: 'breakfast', hour: 8.0 },
      { slot: 'lunch', hour: 14.0 },
      { slot: 'dinner', hour: 20.0 },
    ]
    if (rand() < 0.5) plan.push({ slot: 'snack', hour: 16.5 })
    for (const { slot, hour } of plan) {
      const m = pick(MEALS[slot])
      meals.push({
        user_id: userId,
        consumed_at: ts(date, hour),
        name: m.name,
        protein_g: m.protein_g,
        calories: m.calories,
        meal_type: slot,
        source: 'manual',
      })
    }

    // ── water — a bit higher on training days ────────────────────────
    water.push({
      user_id: userId,
      intake_date: date,
      glasses: clamp(Math.round(5 + (trains ? 1.6 : 0) + rand() * 2.4), 3, 10),
    })

    // ── body measurements — weekly, slow downward trend ──────────────
    if (d % 7 === 2) {
      const progress = (DAYS - 1 - d) / (DAYS - 1) // 0 → 1
      measurements.push({
        user_id: userId,
        measured_at: ts(date, 7.5),
        weight_kg: +(67.5 - progress * 1.2).toFixed(1),
        waist_cm: +(78.0 - progress * 1.5).toFixed(1),
        body_fat_pct: +(28.0 - progress * 1.6).toFixed(1),
        muscle_mass_kg: +(24.4 + progress * 0.5).toFixed(2),
      })
    }
  }

  const cycle = PERIODS.flatMap((p) => [
    { user_id: userId, event_type: 'period_start', event_date: p.start, flow: 'medium' },
    { user_id: userId, event_type: 'period_end', event_date: p.end, flow: null },
  ])

  await insert('sleep_logs', sleep)
  await insert('wellbeing_checkins', wellbeing)
  await insert('cycle_events', cycle)
  await insert('mood_checkins', moods)
  await insert('meals', meals)
  await insert('workouts', workouts)
  await insert('water_intake', water)
  await insert('body_measurements', measurements)

  console.log('\nSeeded:')
  console.log(`  sleep_logs          ${sleep.length}`)
  console.log(`  wellbeing_checkins  ${wellbeing.length}`)
  console.log(`  cycle_events        ${cycle.length}`)
  console.log(`  mood_checkins       ${moods.length}`)
  console.log(`  meals               ${meals.length}`)
  console.log(`  workouts            ${workouts.length}`)
  console.log(`  water_intake        ${water.length}`)
  console.log(`  body_measurements   ${measurements.length}`)
  console.log(`\nSign in to see it: ${TEST_EMAIL} / ${TEST_PASSWORD}`)
}

main().catch((e) => {
  console.error('\nSeed failed:', e.message)
  process.exit(1)
})
