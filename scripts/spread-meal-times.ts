/*
 * Dev utility: spread the most recent day's meals across the clock so
 * the estela shows varied period glyphs (Desayuno / Comida / Cena /
 * Snack) instead of every meal landing in one bucket.
 *
 * Usage:  pnpm tsx scripts/spread-meal-times.ts <email>
 *   e.g.  pnpm tsx scripts/spread-meal-times.ts tatellog@gmail.com
 *
 * Rewrites consumed_at (keeping each meal's calendar day) and the
 * matching meal_type — one meal per period, cycling if there are
 * more than four.
 *
 * Requires in `.env.local`:
 *   EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2]

if (!url || !serviceKey) {
  console.error('Faltan envs en .env.local: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!email) {
  console.error('Uso: pnpm tsx scripts/spread-meal-times.ts <email>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// One target slot per period — local hour/minute + matching meal_type.
const SLOTS = [
  { h: 8, m: 15, type: 'breakfast', label: 'Desayuno' },
  { h: 13, m: 30, type: 'lunch', label: 'Comida' },
  { h: 19, m: 0, type: 'dinner', label: 'Cena' },
  { h: 22, m: 15, type: 'snack', label: 'Snack' },
] as const

async function run(email: string): Promise<void> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) throw listError

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`[spread-meal-times] no se encontró un usuario con email ${email}`)
    process.exit(1)
  }

  const { data: meals, error: readError } = await supabase
    .from('meals')
    .select('id, name, consumed_at')
    .eq('user_id', user.id)
    .order('consumed_at', { ascending: true })
    .limit(40)
  if (readError) throw readError
  if (!meals || meals.length === 0) {
    console.error('[spread-meal-times] el usuario no tiene comidas')
    process.exit(1)
  }

  // Only the most recent calendar day's meals — that is the estela.
  const lastDay = new Date(meals[meals.length - 1]!.consumed_at).toDateString()
  const todays = meals.filter((m) => new Date(m.consumed_at).toDateString() === lastDay)

  for (let i = 0; i < todays.length; i++) {
    const meal = todays[i]!
    const slot = SLOTS[i % SLOTS.length]!
    const when = new Date(meal.consumed_at)
    when.setHours(slot.h, slot.m, 0, 0)

    const { error: writeError } = await supabase
      .from('meals')
      .update({ consumed_at: when.toISOString(), meal_type: slot.type })
      .eq('id', meal.id)
    if (writeError) throw writeError

    console.log(
      `[spread-meal-times] "${meal.name}" → ${slot.label} ` +
        `(${slot.h}:${String(slot.m).padStart(2, '0')})`,
    )
  }
}

run(email).catch((err) => {
  console.error('[spread-meal-times] error:', err)
  process.exit(1)
})
