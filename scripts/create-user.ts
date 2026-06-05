/*
 * Crear un nuevo user en la DB de Supabase.
 *
 *   pnpm tsx scripts/create-user.ts <email> <password>
 *
 * Usa `auth.admin.createUser` (requiere service role) para bypassear
 * el flow normal de signup y crear el user CONFIRMED por defecto.
 *
 * Requiere en `.env.local`:
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role
 *
 * Las downstream rows (profile, etc.) se crean vía DB triggers en el
 * `INSERT ON auth.users` — no las tocamos aquí.
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
  console.error('Uso: pnpm tsx scripts/create-user.ts <email> <password>')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main(): Promise<void> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    console.error(`[create-user] ${error.message}`)
    process.exit(2)
  }
  console.log(`[create-user] OK · ${data.user.email} · id=${data.user.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(3)
})
