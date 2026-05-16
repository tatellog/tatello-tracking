/*
 * Dev utility: seed two "front" progress photos so the Progreso tab's
 * before/after diptych — and the "Compartir mi cambio" carousel —
 * have something to render.
 *
 * Usage:
 *   pnpm tsx scripts/seed-photos.ts [email] [antes] [ahora]
 *
 *   - With two image paths (jpg/png): uploads those.
 *   - Without them: generates two portrait gradient placeholders.
 *
 *   e.g.  pnpm tsx scripts/seed-photos.ts tatellog@gmail.com ~/antes.jpg ~/ahora.jpg
 *
 * Clears the user's existing front photos, then uploads the pair to
 * the progress-photos bucket and inserts photos rows dated ~60 days
 * apart (the first is the "antes", the second the "ahora").
 *
 * Requires in `.env.local`:
 *   EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { deflateSync } from 'node:zlib'

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.argv[2] ?? 'tatellog@gmail.com'
const beforeArg = process.argv[3]
const afterArg = process.argv[4]

if (!url || !serviceKey) {
  console.error('Faltan envs en .env.local: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const DAY_MS = 24 * 60 * 60 * 1000

function isPng(file: string): boolean {
  return extname(file).toLowerCase() === '.png'
}

// ── Minimal PNG encoder for the placeholder fallback ─────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    c = (CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)) >>> 0
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

type RGB = [number, number, number]

function gradientPng(w: number, h: number, top: RGB, bottom: RGB): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y += 1) {
    const t = h > 1 ? y / (h - 1) : 0
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t)
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t)
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t)
    const rowStart = y * (1 + w * 3)
    raw[rowStart] = 0
    for (let x = 0; x < w; x += 1) {
      const p = rowStart + 1 + x * 3
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

type Shot = { takenAt: Date; bytes: Buffer; png: boolean }

function buildShots(): Shot[] {
  const antesAt = new Date(Date.now() - 60 * DAY_MS)
  const ahoraAt = new Date()

  if (beforeArg && afterArg) {
    return [
      { takenAt: antesAt, bytes: readFileSync(beforeArg), png: isPng(beforeArg) },
      { takenAt: ahoraAt, bytes: readFileSync(afterArg), png: isPng(afterArg) },
    ]
  }
  return [
    { takenAt: antesAt, bytes: gradientPng(600, 800, [58, 51, 64], [22, 18, 26]), png: true },
    { takenAt: ahoraAt, bytes: gradientPng(600, 800, [120, 30, 70], [34, 14, 22]), png: true },
  ]
}

async function run(emailArg: string): Promise<void> {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) throw listError

  const user = list.users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase())
  if (!user) {
    console.error(`[seed-photos] no se encontró un usuario con email ${emailArg}`)
    process.exit(1)
  }

  // Clear existing front photos — rows and their storage objects.
  const { data: existing, error: readError } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('user_id', user.id)
    .eq('angle', 'front')
  if (readError) throw readError

  if (existing && existing.length > 0) {
    await supabase.storage.from('progress-photos').remove(existing.map((r) => r.storage_path))
    await supabase.from('photos').delete().eq('user_id', user.id).eq('angle', 'front')
    console.log(`[seed-photos] limpié ${existing.length} foto(s) frontal(es) previa(s)`)
  }

  for (const shot of buildShots()) {
    const path = `${user.id}/${shot.takenAt.getTime()}_front.${shot.png ? 'png' : 'jpg'}`
    const { error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(path, shot.bytes, {
        contentType: shot.png ? 'image/png' : 'image/jpeg',
        upsert: true,
      })
    if (uploadError) throw uploadError

    const { error: insertError } = await supabase.from('photos').insert({
      user_id: user.id,
      angle: 'front',
      storage_path: path,
      taken_at: shot.takenAt.toISOString(),
    })
    if (insertError) throw insertError

    console.log(`[seed-photos] subida → ${path}`)
  }

  console.log('[seed-photos] listo — abre Progreso para ver tu antes/ahora')
}

run(email).catch((err) => {
  console.error('[seed-photos] error:', err)
  process.exit(1)
})
