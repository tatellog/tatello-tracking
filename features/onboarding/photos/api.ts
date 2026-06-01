import * as ImageManipulator from 'expo-image-manipulator'
import { Platform } from 'react-native'

import { requireUserId, supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'

import type { PhotoAngle } from './hooks/usePhotosToday'

type UploadResult = {
  storage_path: string
  width: number | null
  height: number | null
  byte_size: number
}

// 1080 px wide is plenty for a progress photo (shown ~150 px in the
// diptych, fine in the share card too) and keeps the upload small so it
// finishes fast on a phone connection.
const MAX_WIDTH = 1080
const JPEG_QUALITY = 0.72
// Hard ceilings so a stalled connection fails (recoverable) instead of
// hanging the spinner forever.
const UPLOAD_TIMEOUT_MS = 30_000

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
  // Guard against the silent-0-byte upload: if the compressed buffer
  // is empty something went wrong in the pipeline. Better to surface
  // an error here than ship a phantom record + 0-byte storage object.
  if (compressed.byteSize === 0) {
    throw new Error('La imagen quedó vacía al procesarla.')
  }
  const path = `${userId}/${Date.now()}_${angle}.jpg`

  // React Native's fetch().blob() uploads 0 bytes to Supabase Storage
  // — the SDK reads zero from the Blob. An ArrayBuffer carries the
  // real bytes, which is the documented RN pattern (same fix lives in
  // profile/api.ts uploadAvatar).
  const { error: uploadErr } = await withTimeout(
    supabase.storage.from('progress-photos').upload(path, compressed.bytes, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
    }),
    UPLOAD_TIMEOUT_MS,
    'La foto tardó demasiado en subir. Revisa tu conexión e intenta de nuevo.',
  )
  if (uploadErr) throw uploadErr

  const { error: insertErr } = await withTimeout(
    // Promise.resolve adopts the Postgrest thenable into a real Promise so
    // Promise.race (inside withTimeout) accepts it.
    Promise.resolve(
      supabase.from('photos').insert({
        user_id: userId,
        angle,
        storage_path: path,
        width: compressed.width,
        height: compressed.height,
        byte_size: compressed.byteSize,
      }),
    ),
    UPLOAD_TIMEOUT_MS,
  )
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
    byte_size: compressed.byteSize,
  }
}

type Compressed = { bytes: ArrayBuffer; byteSize: number; width: number; height: number }

async function compressOnNative(uri: string): Promise<Compressed> {
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  )
  // ArrayBuffer, not Blob — see comment in processAndUploadFromUri.
  const bytes = await fetch(processed.uri).then((r) => r.arrayBuffer())
  return {
    bytes,
    byteSize: bytes.byteLength,
    width: processed.width,
    height: processed.height,
  }
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
  // Browsers handle Blob → ArrayBuffer cleanly; unifying the upload
  // path on bytes keeps the Native/Web call sites identical.
  const bytes = await blob.arrayBuffer()
  return { bytes, byteSize: bytes.byteLength, width: outW, height: outH }
}
