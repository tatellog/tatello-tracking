/*
 * One-off: borra los archivos de Storage de UN usuario (avatars, meal-photos,
 * progress-photos) usando la Storage API con service-role — la forma correcta
 * (borra la fila de storage.objects Y el objeto en S3; el trigger
 * storage.protect_delete impide hacerlo por SQL).
 *
 *   node scripts/clean-orphan-storage.mjs <user_id>
 *
 * Sin arg usa el USER_ID por defecto (el reseteado en esta sesión).
 */
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !SERVICE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

const admin = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USER_ID = process.argv[2] ?? 'c7c6c638-0242-4f3b-a830-c57630cd3bb0'
const BUCKETS = ['avatars', 'meal-photos', 'progress-photos']

let total = 0
for (const bucket of BUCKETS) {
  const { data, error } = await admin.storage.from(bucket).list(USER_ID, { limit: 1000 })
  if (error) {
    console.error(`[${bucket}] list error:`, error.message)
    continue
  }
  if (!data || data.length === 0) {
    console.log(`[${bucket}] (vacío)`)
    continue
  }
  const paths = data.map((f) => `${USER_ID}/${f.name}`)
  const { error: rmErr } = await admin.storage.from(bucket).remove(paths)
  if (rmErr) {
    console.error(`[${bucket}] remove error:`, rmErr.message)
    continue
  }
  total += paths.length
  console.log(`[${bucket}] borrados ${paths.length}`)
}
console.log(`Listo. Total archivos borrados: ${total}`)
