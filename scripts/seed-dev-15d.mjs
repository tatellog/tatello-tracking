/*
 * seed-dev-15d.mjs — simula que el dev user (dev@local.test) empezó
 * hace 15 días: respalda TODO su historial de señales a un JSON,
 * lo borra, y siembra 15 días realistas (2026-05-29 → 2026-06-12)
 * calibrados para que el Emblema Celeste caiga a mitad del arco
 * (~45% → etapa "Toma forma") y la constelación muestre ~5 entrenos
 * de junio.
 *
 *   node scripts/seed-dev-15d.mjs
 *
 * NO toca profiles, macro_targets, fotos ni analytics. El backup
 * queda en /tmp/dev-user-backup-<timestamp>.json (restaurable a mano).
 * Idempotente: re-correrlo vuelve a borrar y sembrar lo mismo.
 */
import { writeFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Faltan envs en .env.local: EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const DEV_EMAIL = 'dev@local.test'
// 15 días terminando HOY (12 jun): 29 may → 12 jun. 12 caen en junio.
const FIRST_DAY = '2026-05-29'
const LAST_DAY = '2026-06-12'
const MX_OFFSET_H = 6

// PRNG determinístico (mulberry32) — misma data en cada corrida.
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260612)
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

function datesBetween(a, b) {
  const out = []
  for (let t = Date.parse(a); t <= Date.parse(b); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

/** Instante UTC para fecha local CDMX + hora local. */
function ts(dateStr, localHour) {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const hh = Math.floor(localHour)
  const mm = Math.round((localHour - hh) * 60)
  return new Date(Date.UTC(y, mo - 1, da, hh, mm) + MX_OFFSET_H * 3600000).toISOString()
}

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
    { name: 'Ensalada con pollo', protein_g: 36, calories: 430 },
  ],
  dinner: [
    { name: 'Salmón con espárragos', protein_g: 40, calories: 470 },
    { name: 'Tacos de pescado', protein_g: 32, calories: 520 },
    { name: 'Sopa de verduras con pollo', protein_g: 30, calories: 360 },
  ],
  snack: [
    { name: 'Barra de proteína', protein_g: 20, calories: 200 },
    { name: 'Puñado de almendras', protein_g: 7, calories: 170 },
  ],
}
const WORKOUT_TYPES = ['Pierna', 'Empuje', 'Jalón', 'Cardio', 'Full body']

// Las tablas-fuente de daily_signals (todas con user_id).
const SIGNAL_TABLES = [
  'sleep_logs',
  'wellbeing_checkins',
  'mood_checkins',
  'meals',
  'workouts',
  'body_measurements',
  'water_intake',
  'rest_days',
  'cycle_events',
]

async function main() {
  const { data: list, error: lerr } = await admin.auth.admin.listUsers({ perPage: 100 })
  if (lerr) throw lerr
  const dev = list.users.find((u) => u.email === DEV_EMAIL)
  if (!dev) throw new Error(`No existe ${DEV_EMAIL}`)
  const userId = dev.id
  console.log(`Dev user: ${DEV_EMAIL} (${userId})`)

  // ── 1. backup completo a /tmp ──────────────────────────────────────
  const backup = {}
  for (const t of SIGNAL_TABLES) {
    const { data, error } = await admin.from(t).select('*').eq('user_id', userId)
    if (error) throw new Error(`backup ${t}: ${error.message}`)
    backup[t] = data
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `/tmp/dev-user-backup-${stamp}.json`
  writeFileSync(backupPath, JSON.stringify(backup, null, 2))
  console.log(
    `Backup: ${backupPath} (${Object.entries(backup)
      .map(([t, r]) => `${t}:${r.length}`)
      .join(' ')})`,
  )

  // ── 2. wipe ────────────────────────────────────────────────────────
  for (const t of SIGNAL_TABLES) {
    const { error } = await admin.from(t).delete().eq('user_id', userId)
    if (error) throw new Error(`wipe ${t}: ${error.message}`)
  }

  // ── 3. siembra 15 días ─────────────────────────────────────────────
  const days = datesBetween(FIRST_DAY, LAST_DAY)
  // Entrena ~4×/semana → 7 de 15 días (5 en junio). Fijo, no aleatorio,
  // para que la constelación quede estable entre corridas.
  const trainDays = new Set([
    '2026-05-29',
    '2026-05-31',
    '2026-06-02',
    '2026-06-04',
    '2026-06-06',
    '2026-06-09',
    '2026-06-11',
  ])

  const sleep = []
  const wellbeing = []
  const moods = []
  const meals = []
  const workouts = []
  const water = []
  const measurements = []

  for (const date of days) {
    const isToday = date === LAST_DAY
    const trains = trainDays.has(date)

    // Sueño: registra ~13 de 15 noches.
    if (rand() < 0.88 || isToday) {
      const sleepHours = clamp(6.4 + rand() * 1.6, 5.2, 8.6)
      const wakeHour = 6.8 + rand() * 1.0
      sleep.push({
        user_id: userId,
        sleep_date: date,
        bedtime: ts(date, wakeHour - sleepHours),
        wake_time: ts(date, wakeHour),
        quality: clamp(Math.round((sleepHours - 4) * 0.85 + (rand() - 0.5)), 1, 5),
        notes: null,
      })
    }

    // Check-in de bienestar: ~13 de 15 días (da energía + checkin).
    if (rand() < 0.88 || isToday) {
      const energy = clamp(Math.round(3 + (trains ? 0.5 : 0) + (rand() - 0.5) * 1.6), 1, 5)
      wellbeing.push({
        user_id: userId,
        checked_at: ts(date, isToday ? 13.5 : 21.3),
        checkin_date: date,
        energy,
        motivation: clamp(Math.round(energy * 0.7 + 1 + (rand() - 0.5)), 1, 5),
        stress: clamp(Math.round(3 - (energy - 3) * 0.6 + (rand() - 0.5)), 1, 5),
        notes: null,
      })
      moods.push({
        user_id: userId,
        value: energy >= 4 ? 'good' : energy >= 2.5 ? 'neutral' : 'struggle',
        checked_at: ts(date, isToday ? 13.6 : 21.0),
      })
    }

    // Comidas: todos los días desayuna; hoy solo desayuno + comida.
    const plan = [
      { slot: 'breakfast', hour: 8.0 },
      { slot: 'lunch', hour: 14.0 },
    ]
    if (!isToday) {
      plan.push({ slot: 'dinner', hour: 20.0 })
      if (rand() < 0.4) plan.push({ slot: 'snack', hour: 16.5 })
    }
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

    if (trains) {
      workouts.push({
        user_id: userId,
        completed_at: ts(date, 18 + rand() * 1.5),
        type: pick(WORKOUT_TYPES),
        notes: null,
      })
    }

    // Agua: completa (≥8) ~6 de 15 días; hoy va a la mitad.
    water.push({
      user_id: userId,
      intake_date: date,
      glasses: isToday ? 4 : clamp(Math.round(5.5 + (trains ? 1.4 : 0) + rand() * 2.6), 4, 10),
    })

    // Peso: semanal.
    if (date === '2026-05-30' || date === '2026-06-06') {
      measurements.push({
        user_id: userId,
        measured_at: ts(date, 7.5),
        weight_kg: date === '2026-05-30' ? 67.4 : 67.1,
        waist_cm: date === '2026-05-30' ? 77.8 : 77.5,
        body_fat_pct: null,
        muscle_mass_kg: null,
      })
    }
  }

  async function insert(table, rows) {
    if (rows.length === 0) return
    const { error } = await admin.from(table).insert(rows)
    if (error) throw new Error(`insert ${table}: ${error.message}`)
  }
  await insert('sleep_logs', sleep)
  await insert('wellbeing_checkins', wellbeing)
  await insert('mood_checkins', moods)
  await insert('meals', meals)
  await insert('workouts', workouts)
  await insert('water_intake', water)
  await insert('body_measurements', measurements)

  // ── 4. reporte: puntos del emblema con la data sembrada ───────────
  const { data: mt } = await admin
    .from('macro_targets')
    .select('protein_g')
    .eq('user_id', userId)
    .maybeSingle()
  const proteinTarget = mt?.protein_g ?? null
  const { data: rows, error: derr } = await admin
    .from('daily_signals')
    .select('day, trained, meal_count, protein_g, sleep_minutes, water_glasses, energy, wellbeing_checkins')
    .eq('user_id', userId)
    .order('day')
  if (derr) throw derr
  let total = 0
  for (const r of rows) {
    if (r.trained) total += 10
    if ((r.meal_count ?? 0) >= 1) total += 3
    if (proteinTarget != null && (r.protein_g ?? 0) >= proteinTarget) total += 6
    if (r.sleep_minutes != null) total += 4
    if ((r.water_glasses ?? 0) >= 8) total += 3
    if (r.energy != null) total += 2
    if ((r.wellbeing_checkins ?? 0) >= 1) total += 2
  }
  const pct = Math.min(100, Math.floor((total / 600) * 100))
  console.log(
    `Sembrados ${rows.length} días (${FIRST_DAY} → ${LAST_DAY}) · ` +
      `entrenos jun: ${[...trainDays].filter((d) => d >= '2026-06-01').length} · ` +
      `emblema: ${total} pts → ${pct}%`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
