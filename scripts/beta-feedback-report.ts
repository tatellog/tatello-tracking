/*
 * Beta feedback inbox — prints every row in public.beta_feedback,
 * newest first, with the user's display name and the screen they
 * were on when they wrote.
 *
 *   pnpm report:feedback
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS so we see
 * everyone's feedback, not just our own).
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

const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const MAGENTA = '\x1b[35m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

type Row = {
  id: string
  user_id: string
  message: string
  screen: string | null
  created_at: string
}

async function main() {
  const { data, error } = await sb
    .from('beta_feedback')
    .select('id, user_id, message, screen, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    console.error(`${RED}Failed to read beta_feedback:${RESET}`, error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as Row[]
  if (rows.length === 0) {
    console.log(`${DIM}No feedback yet — el buzón está vacío.${RESET}`)
    return
  }

  // Pull display_names in one shot so we don't N+1 the API.
  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles } = await sb.from('profiles').select('id, display_name').in('id', userIds)
  const nameById = new Map<string, string>()
  for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
    nameById.set(p.id, p.display_name?.trim() || '(unnamed)')
  }

  console.log(`${BOLD}Beta feedback · ${rows.length} entries${RESET}\n`)
  for (const r of rows) {
    const when = new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16)
    const who = nameById.get(r.user_id) ?? '(unknown)'
    const where = r.screen ? r.screen : `${DIM}—${RESET}`
    console.log(`${DIM}[${when}]${RESET} ${BOLD}${who}${RESET} · ${MAGENTA}${where}${RESET}`)
    console.log(`  > ${r.message.replace(/\n/g, '\n    ')}\n`)
  }
}

main().catch((err) => {
  console.error(`${RED}report:feedback crashed:${RESET}`, err)
  process.exit(1)
})
