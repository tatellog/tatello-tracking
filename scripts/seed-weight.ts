/*
 * Dev utility: seed a declining weight series so the Hoy-tab "Tu peso"
 * slide has a real trend to plot.
 *
 * Usage:  pnpm tsx scripts/seed-weight.ts <email>
 *   e.g.  pnpm tsx scripts/seed-weight.ts tatellog@gmail.com
 *
 * Clears the user's body_measurements and inserts ~10 points over the
 * past ~10 weeks — weight easing from ~79 down to 75 kg with small
 * realistic wobbles.
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
  console.error('Uso: pnpm tsx scripts/seed-weight.ts <email>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Day-offset (negative = days ago) → weight kg. A gentle loss, with
// small ups so the line reads as a real journey, not a ruler.
const SERIES = [
  { day: -72, kg: 79.2 },
  { day: -64, kg: 78.6 },
  { day: -56, kg: 78.8 },
  { day: -48, kg: 78.0 },
  { day: -40, kg: 77.3 },
  { day: -32, kg: 77.5 },
  { day: -24, kg: 76.6 },
  { day: -16, kg: 76.0 },
  { day: -8, kg: 75.4 },
  { day: 0, kg: 75.0 },
]

async function run(email: string): Promise<void> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) throw listError

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`[seed-weight] no se encontró un usuario con email ${email}`)
    process.exit(1)
  }

  const { error: delError } = await supabase
    .from('body_measurements')
    .delete()
    .eq('user_id', user.id)
  if (delError) throw delError

  const rows = SERIES.map((s) => ({
    user_id: user.id,
    weight_kg: s.kg,
    measured_at: new Date(Date.now() + s.day * 24 * 60 * 60 * 1000).toISOString(),
  }))
  const { error: insError } = await supabase.from('body_measurements').insert(rows)
  if (insError) throw insError

  const first = SERIES[0]!
  const last = SERIES[SERIES.length - 1]!
  console.log(
    `[seed-weight] ${email}: ${rows.length} medidas sembradas — ${first.kg} kg → ${last.kg} kg`,
  )
}

run(email).catch((err) => {
  console.error('[seed-weight] error:', err)
  process.exit(1)
})
