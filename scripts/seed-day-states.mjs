/*
 * seed-day-states.mjs — pinta los 7 días de la SEMANA ISO actual (lun→dom) con
 * datos diseñados para que Órbita · Día resuelva a un ESTADO distinto cada día.
 * Así puedes abrir cada día desde la tira de Semana y ver los 7 arquetipos.
 *
 *   SEED_EMAIL='Dev@local.test' node scripts/seed-day-states.mjs
 *
 * Solo toca los 7 días de ESTA semana del usuario indicado (borra esos días
 * antes de reinsertar). No toca otras fechas ni otras cuentas. Idempotente.
 *
 * Estados por día (ver features/orbit/day-state.ts para el algoritmo):
 *   lun Presencia · mar Energía · mié Recuperación · jue Nutrición ·
 *   vie Equilibrio · sáb Exploración · dom (hoy) Constancia
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
if (!URL_ || !SERVICE_KEY) throw new Error('Missing SUPABASE env in .env.local')

const admin = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = process.env.SEED_EMAIL || 'Dev@local.test'
const MX_OFFSET_H = 6 // Mexico City = UTC-6 (sin DST)

// ─── fechas: semana ISO (lun→dom) que contiene HOY (en MX) ───────────
const nowMx = new Date(Date.now() - MX_OFFSET_H * 3600000)
const todayStr = nowMx.toISOString().slice(0, 10)
function addDaysStr(dateStr, n) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}
function isoDow(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay() // 0 Sun..6 Sat
  return d === 0 ? 7 : d // 1 Mon..7 Sun
}
const monday = addDaysStr(todayStr, -(isoDow(todayStr) - 1))
const WEEK = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i)) // lun..dom

/** Instante UTC para una fecha MX local + hora local (float). */
function ts(dateStr, localHour) {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const hh = Math.floor(localHour)
  const mm = Math.round((localHour - hh) * 60)
  return new Date(Date.UTC(y, mo - 1, da, hh, mm) + MX_OFFSET_H * 3600000).toISOString()
}

// ─── usuario ─────────────────────────────────────────────────────────
async function resolveUser(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const u = data.users.find((x) => (x.email ?? '').toLowerCase() === email.toLowerCase())
  if (!u) throw new Error(`No encontré el usuario ${email}`)
  return u.id
}

async function insert(table, rows) {
  if (rows.length === 0) return
  const { error } = await admin.from(table).insert(rows)
  if (error) throw new Error(`insert ${table}: ${error.message}`)
}

// ─── builders por estado ─────────────────────────────────────────────
// Cada uno devuelve filas para las tablas que alimentan daily_signals.
// `acc` acumula por tabla; `uid`, `date`, `T` (metas) en scope.
function makeBuilders(uid, T) {
  const sleepRow = (date, hours, quality = 4) => ({
    user_id: uid,
    sleep_date: date,
    bedtime: ts(date, 7 - hours),
    wake_time: ts(date, 7),
    quality,
    notes: null,
  })
  const workoutRow = (date) => ({
    user_id: uid,
    completed_at: ts(date, 18),
    type: 'Full body',
    notes: null,
  })
  const restRow = (date) => ({ user_id: uid, rest_date: date })
  const waterRow = (date, glasses) => ({ user_id: uid, intake_date: date, glasses })
  const wellbeingRow = (date, energy, motivation, stress) => ({
    user_id: uid,
    checked_at: ts(date, 21),
    checkin_date: date,
    energy,
    motivation,
    stress,
    notes: null,
  })
  const moodRow = (date, value) => ({ user_id: uid, value, checked_at: ts(date, 21) })
  // `mealSet`: reparte proteína/calorías en `n` comidas.
  const mealSet = (date, n, protein, calories) => {
    const slots = ['breakfast', 'lunch', 'dinner', 'snack'].slice(0, n)
    const hours = [8, 14, 20, 16.5]
    const names = ['Avena con fruta', 'Pollo con arroz', 'Salmón con verduras', 'Snack de proteína']
    return slots.map((slot, i) => ({
      user_id: uid,
      consumed_at: ts(date, hours[i]),
      name: names[i],
      protein_g: Math.round(protein / n),
      calories: Math.round(calories / n),
      meal_type: slot,
      source: 'manual',
    }))
  }

  return {
    // ENERGÍA — solo movimiento domina.
    energia: (date, a) => a.workouts.push(workoutRow(date)),
    // RECUPERACIÓN — dormir 8h + día de descanso.
    recuperacion: (date, a) => {
      a.sleep.push(sleepRow(date, 8, 5))
      a.rest.push(restRow(date))
    },
    // NUTRICIÓN — 3 comidas, proteína en meta, déficit sano.
    nutricion: (date, a) => {
      a.meals.push(...mealSet(date, 3, T.protein + 15, Math.round(T.calories * 0.85)))
    },
    // CONSTANCIA — amplitud: 4 señales presentes.
    constancia: (date, a) => {
      a.workouts.push(workoutRow(date))
      a.sleep.push(sleepRow(date, 7, 4))
      a.meals.push(...mealSet(date, 2, Math.round(T.protein * 0.75), 900))
      a.water.push(waterRow(date, 8))
    },
    // EQUILIBRIO — recuperación y nutrición parejas en ★★★, nada dominó.
    equilibrio: (date, a) => {
      a.sleep.push(sleepRow(date, 6.5, 3))
      a.meals.push(...mealSet(date, 3, Math.round(T.protein * 0.8), T.calories + 250))
    },
    // EXPLORACIÓN — lo más fuerte fue el check-in de bienestar.
    exploracion: (date, a) => {
      a.wellbeing.push(wellbeingRow(date, 4, 4, 2))
      a.moods.push(moodRow(date, 'good'))
    },
    // PRESENCIA — registró algo, pero nada llegó a ★★★.
    presencia: (date, a) => {
      a.meals.push(...mealSet(date, 1, 12, 280))
      a.water.push(waterRow(date, 1))
    },
  }
}

// lun→dom
const PLAN = [
  'presencia',
  'energia',
  'recuperacion',
  'nutricion',
  'equilibrio',
  'exploracion',
  'constancia', // domingo = hoy
]

async function main() {
  const uid = await resolveUser(EMAIL)
  console.log(`Usuario: ${EMAIL}  (${uid})`)
  console.log(`Semana ISO: ${WEEK[0]} → ${WEEK[6]}  (hoy ${todayStr})`)

  // Metas de macros (para construir proteína/calorías coherentes).
  const { data: mt } = await admin
    .from('macro_targets')
    .select('protein_g, calories')
    .eq('user_id', uid)
    .maybeSingle()
  const T = { protein: mt?.protein_g ?? 110, calories: mt?.calories ?? 1800 }
  console.log(`Metas: ${T.protein} g proteína · ${T.calories} kcal`)

  // Wipe SOLO de esta semana.
  const utcStart = ts(WEEK[0], 0)
  const utcEnd = ts(addDaysStr(WEEK[6], 1), 0)
  const byDate = [
    ['sleep_logs', 'sleep_date'],
    ['wellbeing_checkins', 'checkin_date'],
    ['water_intake', 'intake_date'],
    ['rest_days', 'rest_date'],
    ['cycle_events', 'event_date'],
  ]
  for (const [table, col] of byDate) {
    const { error } = await admin.from(table).delete().eq('user_id', uid).in(col, WEEK)
    if (error) throw new Error(`wipe ${table}: ${error.message}`)
  }
  const byTs = [
    ['mood_checkins', 'checked_at'],
    ['meals', 'consumed_at'],
    ['workouts', 'completed_at'],
  ]
  for (const [table, col] of byTs) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq('user_id', uid)
      .gte(col, utcStart)
      .lt(col, utcEnd)
    if (error) throw new Error(`wipe ${table}: ${error.message}`)
  }

  // Construir filas.
  const acc = {
    sleep: [],
    wellbeing: [],
    moods: [],
    meals: [],
    workouts: [],
    water: [],
    rest: [],
  }
  const builders = makeBuilders(uid, T)
  WEEK.forEach((date, i) => builders[PLAN[i]](date, acc))

  await insert('sleep_logs', acc.sleep)
  await insert('wellbeing_checkins', acc.wellbeing)
  await insert('mood_checkins', acc.moods)
  await insert('meals', acc.meals)
  await insert('workouts', acc.workouts)
  await insert('water_intake', acc.water)
  await insert('rest_days', acc.rest)

  console.log('\nDías sembrados:')
  WEEK.forEach((date, i) => {
    const dow = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'][i]
    console.log(`  ${dow} ${date}  →  ${PLAN[i]}`)
  })
  console.log('\nAbre Órbita → Semana → toca cada día para ver su arquetipo.')
}

main().catch((e) => {
  console.error('\nSeed falló:', e.message)
  process.exit(1)
})
