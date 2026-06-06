/*
 * Marcar (o desmarcar) un usuario como dev → desbloquea las rutas DEV en
 * Ajustes (ej. "✦ DEV — ver todas las constelaciones").
 *
 *   pnpm tsx scripts/set-dev.ts [email] [true|false]
 *   pnpm tsx scripts/set-dev.ts                       → dev@local.test = true
 *
 * Busca el user por email (auth.admin) y hace UPDATE de profiles.is_dev
 * con el SERVICE ROLE (bypassa RLS). Requiere en .env.local:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2] ?? 'dev@local.test'
const value = (process.argv[3] ?? 'true').toLowerCase() !== 'false'

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(target: string) {
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (found) return found
    if (data.users.length < perPage) return null
  }
}

async function main(): Promise<void> {
  const user = await findUserByEmail(email)
  if (!user) {
    console.error(`[set-dev] No existe user con email ${email}`)
    process.exit(2)
  }
  // profiles.id === auth.users.id (PK con FK a auth.users).
  const { error } = await supabase.from('profiles').update({ is_dev: value }).eq('id', user.id)
  if (error) {
    console.error(`[set-dev] ${error.message}`)
    process.exit(2)
  }
  console.log(`[set-dev] OK · ${email} · is_dev=${value} · id=${user.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(3)
})
