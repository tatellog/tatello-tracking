/*
 * One-off: set the dev user's date of birth to April 30.
 *
 * The zodiac sign is derived from date_of_birth — April 30 lands in
 * Tauro, so this is handy for testing the app with a different
 * constellation than the seeded default.
 *
 * Usage:  pnpm tsx scripts/set-dob.ts
 *
 * Keeps the year of the existing date_of_birth (falls back to 1995,
 * the seed default) and only rewrites month/day to 04-30 — the
 * zodiac cares about month/day, not the year.
 *
 * Requires in `.env.local`:
 *   EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEV_USER_ID
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

async function run(): Promise<void> {
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('date_of_birth')
    .eq('id', devUserId)
    .maybeSingle()
  if (readError) throw readError

  const year = profile?.date_of_birth ? profile.date_of_birth.slice(0, 4) : '1995'
  const nextDob = `${year}-04-30`

  const { error: writeError } = await supabase
    .from('profiles')
    .update({ date_of_birth: nextDob, updated_at: new Date().toISOString() })
    .eq('id', devUserId)
  if (writeError) throw writeError

  console.log(`[set-dob] date_of_birth → ${nextDob} (${profile?.date_of_birth ?? 'null'} antes)`)
}

run().catch((err) => {
  console.error('[set-dob] error:', err)
  process.exit(1)
})
