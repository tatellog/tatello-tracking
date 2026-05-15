/*
 * Dev utility: set a user's date of birth (month/day) so the app
 * shows a different zodiac constellation for testing.
 *
 * Usage:  pnpm tsx scripts/set-dob.ts <email> <MM-DD>
 *   e.g.  pnpm tsx scripts/set-dob.ts tatellog@gmail.com 04-18
 *
 * Looks the user up by email via the admin API, keeps the year of
 * the existing date_of_birth (falls back to 1995) and rewrites only
 * month/day — the zodiac cares about month/day, not the year.
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
const monthDay = process.argv[3]

if (!url || !serviceKey) {
  console.error('Faltan envs en .env.local: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!email || !monthDay || !/^\d{2}-\d{2}$/.test(monthDay)) {
  console.error('Uso: pnpm tsx scripts/set-dob.ts <email> <MM-DD>   (ej. 04-18)')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function run(email: string, monthDay: string): Promise<void> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) throw listError

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`[set-dob] no se encontró un usuario con email ${email}`)
    process.exit(1)
  }

  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('date_of_birth')
    .eq('id', user.id)
    .maybeSingle()
  if (readError) throw readError

  const year = profile?.date_of_birth ? profile.date_of_birth.slice(0, 4) : '1995'
  const nextDob = `${year}-${monthDay}`

  const { error: writeError } = await supabase
    .from('profiles')
    .update({ date_of_birth: nextDob, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (writeError) throw writeError

  console.log(
    `[set-dob] ${email} → date_of_birth ${nextDob} (${profile?.date_of_birth ?? 'null'} antes)`,
  )
}

run(email, monthDay).catch((err) => {
  console.error('[set-dob] error:', err)
  process.exit(1)
})
