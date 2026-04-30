import * as ImageManipulator from 'expo-image-manipulator'
import { Platform } from 'react-native'

import { requireUserId, supabase } from '@/lib/supabase'

import type { PhotoAngle } from './hooks/usePhotosToday'

type UploadResult = {
  storage_path: string
  width: number | null
  height: number | null
  byte_size: number
}

const MAX_WIDTH = 1500
const JPEG_QUALITY = 0.8

/*
 * Resize → JPEG-compress → upload-to-bucket → insert metadata row.
 *
 * Two compression paths converge on the same target (≤ 1500 px wide,
 * JPEG ~80 %, typically 300–600 KB):
 *   - Native: expo-image-manipulator (Skia/CoreImage under the hood).
 *   - Web: <canvas> draw + canvas.toBlob('image/jpeg', 0.8).
 *
 * Output is always JPEG, so the bucket upload's contentType is
 * correctly hardcoded. This also fixes a prior MIME mismatch where
 * web could ship a PNG/HEIC labelled as image/jpeg.
 *
 * Path: {userId}/{epochMillis}_{angle}.jpg. The leading folder is the
 * RLS gate (storage policies match storage.foldername(name)[1] to
 * auth.uid()::text), so this convention is load-bearing — don't
 * change it without revisiting the policies in
 * 20260429120003_progress_photos_storage.sql.
 */
export async function processAndUploadFromUri(
  uri: string,
  angle: PhotoAngle,
): Promise<UploadResult> {
  const userId = await requireUserId()

  const compressed = Platform.OS === 'web' ? await compressOnWeb(uri) : await compressOnNative(uri)
  const path = `${userId}/${Date.now()}_${angle}.jpg`

  const { error: uploadErr } = await supabase.storage
    .from('progress-photos')
    .upload(path, compressed.blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })
  if (uploadErr) throw uploadErr

  const { error: insertErr } = await supabase.from('photos').insert({
    user_id: userId,
    angle,
    storage_path: path,
    width: compressed.width,
    height: compressed.height,
    byte_size: compressed.blob.size,
  })
  if (insertErr) {
    // Best-effort cleanup: if the metadata row fails, the storage
    // object is orphaned. Try to delete it so we don't leak bytes.
    await supabase.storage.from('progress-photos').remove([path])
    throw insertErr
  }

  return {
    storage_path: path,
    width: compressed.width,
    height: compressed.height,
    byte_size: compressed.blob.size,
  }
}

type Compressed = { blob: Blob; width: number; height: number }

async function compressOnNative(uri: string): Promise<Compressed> {
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  )
  const blob = await fetch(processed.uri).then((r) => r.blob())
  return { blob, width: processed.width, height: processed.height }
}

/*
 * Web-only resize+encode pipeline. Works on object URLs from
 * <input type=file>: load into a hidden <img>, draw onto a canvas
 * sized to fit MAX_WIDTH, and encode as JPEG via toBlob.
 *
 * If the image is already narrower than MAX_WIDTH we still re-encode
 * to JPEG so the bucket only stores one format — keeps the cache
 * predictable and avoids HEIC/PNG drifting in.
 */
async function compressOnWeb(uri: string): Promise<Compressed> {
  // The dom global cast is here because the project's TS lib targets
  // React Native by default; this branch only ever executes on web.
  const dom = globalThis as unknown as {
    Image: { new (): HTMLImageElement }
    document: Document
  }

  const img = new dom.Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('La imagen no se pudo leer.'))
    img.src = uri
  })

  const srcW = img.naturalWidth
  const srcH = img.naturalHeight
  if (!srcW || !srcH) throw new Error('La imagen no tiene dimensiones válidas.')

  const scale = srcW > MAX_WIDTH ? MAX_WIDTH / srcW : 1
  const outW = Math.round(srcW * scale)
  const outH = Math.round(srcH * scale)

  const canvas = dom.document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo abrir el canvas para procesar la imagen.')

  // Slight quality boost for the downsample. 'high' enables bicubic
  // on most browsers; falls back to nearest on the rest, which is
  // fine — we're not after pixel-perfect, just below the bucket cap.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, outW, outH)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falló la codificación JPEG.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })

  return { blob, width: outW, height: outH }
}
