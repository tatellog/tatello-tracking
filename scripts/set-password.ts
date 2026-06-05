/*
 * Cambiar la contraseña de un user existente en Supabase Auth.
 *
 *   pnpm tsx scripts/set-password.ts <email> <nuevo-password>
 *
 * Busca el user por email y usa `auth.admin.updateUserById` (requiere
 * service role) para setear la nueva contraseña.
 *
 * Requiere en `.env.local`:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const [email, password] = process.argv.slice(2)

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}
if (!email || !password) {
  console.error('Uso: pnpm tsx scripts/set-password.ts <email> <nuevo-password>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(target: string) {
  // Paginamos sobre la lista de users de Auth hasta encontrar el email.
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
    console.error(`[set-password] No existe user con email ${email}`)
    process.exit(2)
  }
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, { password })
  if (error) {
    console.error(`[set-password] ${error.message}`)
    process.exit(2)
  }
  console.log(`[set-password] OK · ${data.user.email} · id=${data.user.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(3)
})
