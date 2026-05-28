/*
 * Pre-deploy RLS smoke test.
 *
 *   pnpm check:rls
 *
 * Verifies every public table has RLS enabled AND at least one
 * policy. Exits non-zero on any failure so it can be wired into a
 * CI step / git pre-push hook.
 *
 * Uses the service-role key + the public.check_rls_status() function
 * (created in 20260527120000_check_rls_helper.sql). The function is
 * security-definer so it can read pg_class.relrowsecurity for every
 * table regardless of who calls it.
 *
 * Requires in `.env.local`:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role, bypassea RLS
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

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/*
 * Tables intentionally exempt from the RLS check. Add a table here
 * only when you have a real reason (e.g. a lookup table everyone
 * should read with no per-user scoping) AND leave a comment.
 *
 * Currently empty — every public table MUST have RLS + policies.
 */
const EXEMPT_TABLES = new Set<string>([])

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

type Row = {
  table_name: string
  rls_enabled: boolean
  policy_count: number
}

async function main() {
  const { data, error } = await supabase.rpc('check_rls_status')
  if (error) {
    console.error(`${RED}check_rls_status() failed:${RESET}`, error.message)
    console.error(
      `${DIM}If the function does not exist yet, push migrations first (supabase db push).${RESET}`,
    )
    process.exit(1)
  }

  const rows = (data ?? []) as Row[]
  if (rows.length === 0) {
    console.error(`${RED}No public tables returned — schema unreachable?${RESET}`)
    process.exit(1)
  }

  console.log(`${BOLD}RLS smoke test · ${rows.length} public tables${RESET}\n`)

  let failed = 0
  for (const row of rows) {
    const exempt = EXEMPT_TABLES.has(row.table_name)
    const ok = exempt || (row.rls_enabled && row.policy_count > 0)
    const tag = exempt ? `${DIM}exempt${RESET}` : ok ? `${GREEN}ok${RESET}` : `${RED}FAIL${RESET}`
    const rls = row.rls_enabled ? 'RLS on' : `${RED}RLS off${RESET}`
    const pol = `${row.policy_count} polic${row.policy_count === 1 ? 'y' : 'ies'}`
    console.log(`  ${tag.padEnd(20)} ${row.table_name.padEnd(36)} ${rls.padEnd(20)} ${pol}`)
    if (!ok) failed += 1
  }

  if (failed > 0) {
    console.log(`\n${RED}${failed} table(s) without RLS or policies. Fix before deploy.${RESET}`)
    process.exit(1)
  }
  console.log(`\n${GREEN}All public tables have RLS + policies.${RESET}`)
}

main().catch((err) => {
  console.error(`${RED}check:rls crashed:${RESET}`, err)
  process.exit(1)
})
