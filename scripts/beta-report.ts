/*
 * Beta cohort report — per-user summary of usage, intended to be
 * read at-a-glance to decide what's working in the MVP.
 *
 *   pnpm report:beta
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS so we can read
 * everyone's events). Only counts users with profiles.is_beta = true.
 *
 * Metrics printed per user:
 *   • Active days  — distinct dates with ≥1 analytics_event
 *   • Last open    — most recent `app_opened` timestamp
 *   • Meals total  — count of `meal_logged` events
 *   • Day-7 retain — whether they fired ANY event between 6 and 9
 *                    days after their first `app_opened` (window
 *                    instead of strict day 7 — 4 users is too few
 *                    for a sharp boundary)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Faltan envs en .env.local:\n  EXPO_PUBLIC_SUPABASE_URL\n  SUPABASE_SERVICE_ROLE_KEY',
  )
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const DAY_MS = 24 * 60 * 60 * 1000

type BetaProfile = { id: string; display_name: string | null }
type Event = { event_name: string; created_at: string }

async function main() {
  const { data: betas, error: profErr } = await sb
    .from('profiles')
    .select('id, display_name')
    .eq('is_beta', true)
  if (profErr) {
    console.error(`${RED}Failed to read profiles:${RESET}`, profErr.message)
    process.exit(1)
  }
  const cohort = (betas ?? []) as BetaProfile[]
  if (cohort.length === 0) {
    console.log(`${DIM}No beta users yet — flip profiles.is_beta = true to enrol.${RESET}`)
    return
  }

  console.log(`${BOLD}Beta report · ${cohort.length} users${RESET}\n`)
  for (const user of cohort) {
    const { data: events, error: evErr } = await sb
      .from('analytics_events')
      .select('event_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (evErr) {
      console.error(`${RED}  events read failed for ${user.id}:${RESET}`, evErr.message)
      continue
    }
    const rows = (events ?? []) as Event[]
    const name = user.display_name?.trim() || '(unnamed)'

    if (rows.length === 0) {
      console.log(`  ${BOLD}${name}${RESET} ${DIM}(${user.id.slice(0, 8)})${RESET}`)
      console.log(`    ${DIM}no events yet${RESET}\n`)
      continue
    }

    // Distinct YYYY-MM-DD dates with at least one event.
    const dates = new Set(rows.map((r) => r.created_at.slice(0, 10)))
    const activeDays = dates.size

    const opens = rows.filter((r) => r.event_name === 'app_opened')
    const firstOpen = opens[0] ?? rows[0]!
    const lastOpen = opens[opens.length - 1]

    const mealsTotal = rows.filter((r) => r.event_name === 'meal_logged').length

    // Day-7 retention window: any event between day 6 and day 9
    // after the first app_opened.
    const firstOpenMs = new Date(firstOpen.created_at).getTime()
    const windowStart = firstOpenMs + 6 * DAY_MS
    const windowEnd = firstOpenMs + 9 * DAY_MS
    const retainedD7 = rows.some((r) => {
      const t = new Date(r.created_at).getTime()
      return t >= windowStart && t <= windowEnd
    })

    const retainTag = retainedD7 ? `${GREEN}yes${RESET}` : `${RED}no${RESET}`
    const lastOpenFmt = lastOpen ? new Date(lastOpen.created_at).toISOString() : `${DIM}—${RESET}`

    console.log(`  ${BOLD}${name}${RESET} ${DIM}(${user.id.slice(0, 8)})${RESET}`)
    console.log(`    active days  : ${activeDays}`)
    console.log(`    last open    : ${lastOpenFmt}`)
    console.log(`    meals total  : ${mealsTotal}`)
    console.log(`    day-7 retain : ${retainTag} ${DIM}(window 6–9 days from first open)${RESET}\n`)
  }
}

main().catch((err) => {
  console.error(`${RED}report:beta crashed:${RESET}`, err)
  process.exit(1)
})
