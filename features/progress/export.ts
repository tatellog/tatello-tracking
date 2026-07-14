import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'

import { getBodyCheckins, getMeasurements, getPhotoTimeline } from './api'
import { measurementsCsv } from './logic'

/*
 * Propiedad de datos (decisión benchmark + target-user): "el día que sienta
 * que la tabla y las fotos son mías pase lo que pase, le meto todo sin miedo".
 * Modelo Apple Health: exportar es gratis, siempre, sin ceremonia. Anti-modelo:
 * el CSV premium-gated de MyFitnessPal.
 *
 * API legacy de expo-file-system a propósito: la ruta 'expo-file-system/legacy'
 * es estable en SDK 54 y este módulo solo necesita escribir un archivo chico y
 * descargar fotos al caché.
 */

/** Permiso write-only de Fotos (suficiente para guardar; menos invasivo). */
async function ensurePhotoPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(true)
  if (current.granted) return true
  const next = await MediaLibrary.requestPermissionsAsync(true)
  return next.granted
}

/** Guarda una foto recién tomada al carrete, en silencio. `false` = sin
 *  permiso (no insistimos: el rescate masivo vive en Ajustes). */
export async function trySaveUriToLibrary(uri: string): Promise<boolean> {
  try {
    if (!(await ensurePhotoPermission())) return false
    await MediaLibrary.saveToLibraryAsync(uri)
    return true
  } catch {
    return false
  }
}

/** Exporta TODAS las mediciones (check-ins + pesajes de la app) como CSV vía
 *  el share sheet nativo. `'empty'` = no hay nada que exportar aún. */
export async function exportMeasurementsCsv(): Promise<'shared' | 'empty'> {
  const [checkins, measurements] = await Promise.all([getBodyCheckins(), getMeasurements(null)])
  if (checkins.length === 0 && measurements.length === 0) return 'empty'
  const csv = measurementsCsv(checkins, measurements)
  const uri = `${FileSystem.cacheDirectory}stelar-mediciones.csv`
  await FileSystem.writeAsStringAsync(uri, csv)
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Tus mediciones',
    UTI: 'public.comma-separated-values-text',
  })
  return 'shared'
}

export type PhotoRescueResult =
  | { status: 'denied' }
  | { status: 'empty' }
  | { status: 'done'; saved: number; failed: number }

/** Rescate one-time: descarga todas las fotos de progreso del bucket y las
 *  guarda en el carrete. Las fotos tomadas con la cámara de la app antes del
 *  dual-save solo existían en Supabase (el pánico de la usuaria era literal). */
export async function savePhotosToLibrary(): Promise<PhotoRescueResult> {
  if (!(await ensurePhotoPermission())) return { status: 'denied' }
  const photos = await getPhotoTimeline()
  const withUrl = photos.filter((p) => p.signed_url != null)
  if (withUrl.length === 0) return { status: 'empty' }
  let saved = 0
  let failed = 0
  for (const p of withUrl) {
    try {
      // Secuencial a propósito (conexión de teléfono): un fallo no descarta
      // las demás.
      const local = `${FileSystem.cacheDirectory}stelar-foto-${p.id}.png`
      await FileSystem.downloadAsync(p.signed_url!, local)
      await MediaLibrary.saveToLibraryAsync(local)
      saved += 1
    } catch {
      failed += 1
    }
  }
  return { status: 'done', saved, failed }
}
