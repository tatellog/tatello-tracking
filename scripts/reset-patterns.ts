/*
 * Dev-only: limpia las observaciones de patrón de un usuario para poder
 * VOLVER A VER el reveal (modal de patrón) en la app.
 *
 * El hook usePatternDetection se rinde si ya hubo un patrón en los
 * últimos 7 días (detected_patterns). Borrando esas filas, el próximo
 * open del tab Hoy vuelve a correr los detectores y, si disparan,
 * muestra el modal otra vez.
 *
 *   pnpm tsx scripts/reset-patterns.ts            → usa dev@local.test
 *   pnpm tsx scripts/reset-patterns.ts <email>    → otro usuario
 *
 * Requiere en .env.local (NO se commitea):
 *   EXPO_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   ← service role, bypassea RLS
 *
 * Solo borra detected_patterns del user indicado. No toca meals,
 * workouts ni nada más — los datos que disparan la detección siguen ahí.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'dev@local.test'

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserIdByEmail(targetEmail: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())
  return match?.id ?? null
}

async function main(): Promise<void> {
  const userId = await findUserIdByEmail(email)
  if (!userId) {
    console.error(`No se encontró ningún usuario con email "${email}"`)
    process.exit(2)
  }

  // Cuántas filas hay antes (para reportar).
  const { count: before } = await supabase
    .from('detected_patterns')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { error } = await supabase.from('detected_patterns').delete().eq('user_id', userId)
  if (error) throw error

  console.log(`[reset-patterns] ${email} (${userId})`)
  console.log(`[reset-patterns] borradas ${before ?? 0} filas de detected_patterns.`)
  console.log('[reset-patterns] Abrí el tab Hoy: si un detector dispara, verás el modal.')
  console.log('[reset-patterns] (night_eating: ≥2 comidas después de las 21:00 en 7 días).')
}

main().catch((e) => {
  console.error('[reset-patterns] error:', e)
  process.exit(1)
})
