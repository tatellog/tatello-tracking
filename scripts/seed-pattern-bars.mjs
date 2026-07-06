/*
 * Seed de DEMO para la Etapa 3 (barras de correlación entreno×déficit).
 *
 * Crea un usuario cuyos DÍAS DE ENTRENO son claramente más de déficit que los
 * días sin entreno, para que el detector `movement-deficit` dispare y la
 * ceremonia del patrón "Un ritmo de entreno" muestre las BARRAS pareadas
 * ("Con entreno 18/21 · Sin entreno 2/14"), no la tira de frecuencia.
 *
 *   node scripts/seed-pattern-bars.mjs
 *   → login: barras@stelar.test / test123
 *
 * NUNCA toca tu cuenta real. Datos deterministas (reproducible).
 */
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE_KEY) throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } })

// Usuario de DEMO dedicado (no toca dev). Override con SEED_EMAIL=otro@correo.
const TEST_EMAIL = process.env.SEED_EMAIL ?? 'barras@stelar.test'
const TEST_PASSWORD = 'test123'
const DAYS = 35
const TARGET_CAL = 1900
const MX_OFFSET_H = 6

// Base = HOY (UTC midnight) → los datos caen en la ventana reciente del calendario.
const BASE = process.env.SEED_BASE
  ? Date.parse(`${process.env.SEED_BASE}T00:00:00Z`)
  : Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)

const localDate = (daysAgo) => new Date(BASE - daysAgo * 86400000).toISOString().slice(0, 10)
function ts(dateStr, localHour) {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const hh = Math.floor(localHour)
  const mm = Math.round((localHour - hh) * 60)
  return new Date(Date.UTC(y, mo - 1, da, hh, mm) + MX_OFFSET_H * 3600000).toISOString()
}

// Comidas que suman déficit (~1550 kcal, 110g proteína) vs superávit (~2300, 90g).
const DEF_MEALS = [
  { name: 'Avena con fruta', meal_type: 'breakfast', hour: 8, protein_g: 30, calories: 350 },
  { name: 'Pollo con arroz y verduras', meal_type: 'lunch', hour: 14, protein_g: 40, calories: 600 },
  { name: 'Salmón con espárragos', meal_type: 'dinner', hour: 20, protein_g: 40, calories: 600 },
]
const SUR_MEALS = [
  { name: 'Hotcakes con miel', meal_type: 'breakfast', hour: 8, protein_g: 25, calories: 550 },
  { name: 'Pasta con crema', meal_type: 'lunch', hour: 14, protein_g: 35, calories: 850 },
  { name: 'Pizza y refresco', meal_type: 'dinner', hour: 20, protein_g: 30, calories: 900 },
]

async function getOrCreateUser() {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const found = list.users.find((u) => u.email === TEST_EMAIL)
  if (found) return found.id
  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  return data.user.id
}

async function insert(table, rows) {
  if (!rows.length) return
  const { error } = await admin.from(table).insert(rows)
  if (error) throw new Error(`insert ${table}: ${error.message}`)
}

async function main() {
  const userId = await getOrCreateUser()
  console.log(`Usuario: ${TEST_EMAIL}  (${userId})`)

  for (const t of ['meals', 'workouts', 'water_intake', 'revelations', 'sleep_logs', 'rest_days']) {
    await admin.from(t).delete().eq('user_id', userId)
  }
  await admin
    .from('profiles')
    .upsert({
      id: userId,
      date_of_birth: '1995-08-14',
      onboarding_completed_at: ts(localDate(DAYS - 1), 9),
    })
  await admin.from('macro_targets').upsert({ user_id: userId, protein_g: 105, calories: TARGET_CAL })

  const meals = []
  const workouts = []
  const water = []
  let trainedN = 0
  let defTrained = 0
  let restN = 0
  let defRest = 0

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = localDate(d)
    // ~60% de días con entreno; los últimos 7 días traen 5 entrenos (para que el
    // patrón "ritmo de entreno" sea real: ≥3 de 7).
    const trained = d % 5 < 3
    // Días de entreno → déficit (salvo ~1 de cada 11); sin entreno → superávit
    // (salvo ~1 de cada 7). Correlación fuerte y clara.
    const deficit = trained ? d % 11 !== 0 : d % 7 === 0
    const menu = deficit ? DEF_MEALS : SUR_MEALS

    for (const m of menu) {
      meals.push({
        user_id: userId,
        consumed_at: ts(date, m.hour),
        name: m.name,
        protein_g: m.protein_g,
        calories: m.calories,
        meal_type: m.meal_type,
        source: 'manual',
      })
    }
    if (trained) {
      workouts.push({ user_id: userId, completed_at: ts(date, 18), type: 'strength', notes: null })
      trainedN++
      if (deficit) defTrained++
    } else {
      restN++
      if (deficit) defRest++
    }
    water.push({ user_id: userId, intake_date: date, glasses: trained ? 8 : 6 })
  }

  // El evento del calendario que abre la ceremonia (deduplicado a 1 por kind).
  const revelations = [
    {
      user_id: userId,
      tier: 'pattern',
      kind: 'training_consistent',
      title: 'Un ritmo de entreno.',
      shown_at: ts(localDate(2), 12),
      metadata: { count: 5, window_days: 7 },
    },
  ]

  await insert('meals', meals)
  await insert('workouts', workouts)
  await insert('water_intake', water)
  await insert('revelations', revelations)

  console.log(`\nSeeded ${DAYS} días:`)
  console.log(`  meals      ${meals.length}`)
  console.log(`  workouts   ${workouts.length}`)
  console.log(`  water      ${water.length}`)
  console.log(`  revelation training_consistent (abre la ceremonia)`)
  console.log(`\nCorrelación horneada (lo que verás en las barras):`)
  console.log(`  Con entreno: ${defTrained}/${trainedN} en déficit  (${Math.round((defTrained / trainedN) * 100)}%)`)
  console.log(`  Sin entreno: ${defRest}/${restN} en déficit  (${Math.round((defRest / restN) * 100)}%)`)
  console.log(`\nEntra con: ${TEST_EMAIL} / ${TEST_PASSWORD}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
