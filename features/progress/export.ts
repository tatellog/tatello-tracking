import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

import { getBodyCheckins, getMeasurements, getPhotoTimeline } from './api'
import { checkinTable, measurementsCsv } from './logic'

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

const MESES_PDF = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]
const fmtColPdf = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES_PDF[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`
const fmtCellPdf = (v: number | null): string => {
  if (v == null) return '·'
  return v % 1 === 0 ? `${v}` : v.toFixed(1)
}
const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Exporta la tabla completa como PDF con el MISMO layout que la tabla del
 *  coach (pedido dueña 14 jul 2026): filas = métricas, columnas = fechas,
 *  bandas por grupo. SIN semáforo de colores: marcar rangos "saludables/
 *  altos" es juicio clínico (línea roja del manifiesto) — ese criterio es
 *  del profesional, no de Stelar. */
export async function exportMeasurementsPdf(): Promise<'shared' | 'empty'> {
  const checkins = await getBodyCheckins()
  if (checkins.length === 0) return 'empty'
  const table = checkinTable(checkins)
  if (table.cols.length === 0) return 'empty'

  const headRow = `<tr><th class="corner"></th>${table.cols
    .map((c) => `<th>${escapeHtml(fmtColPdf(c.day))}</th>`)
    .join('')}</tr>`

  const bodyRows = table.groups
    .map((g) => {
      const band =
        g.title === 'Básicos'
          ? ''
          : `<tr class="band"><td colspan="${table.cols.length + 1}">${escapeHtml(g.title)}</td></tr>`
      const rows = g.rows
        .map(
          (r) =>
            `<tr><td class="label">${escapeHtml(r.label)}${
              r.unit ? ` <span class="unit">${escapeHtml(r.unit)}</span>` : ''
            }</td>${r.values.map((v) => `<td class="val">${fmtCellPdf(v)}</td>`).join('')}</tr>`,
        )
        .join('')
      return band + rows
    })
    .join('')

  const html = `
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1c1c1c; padding: 24px; }
      h1 { font-size: 15px; margin: 0 0 2px; }
      .sub { font-size: 10px; color: #777; margin: 0 0 14px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #c9c9c9; padding: 6px 8px; font-size: 11px; }
      th { background: #efefef; text-align: right; font-weight: 700; }
      th.corner { background: #efefef; }
      td.label { font-weight: 700; text-align: left; }
      td.label .unit { font-weight: 400; color: #888; font-size: 9px; }
      td.val { text-align: right; font-variant-numeric: tabular-nums; }
      tr.band td { background: #ead9c9; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 10px; }
      .foot { margin-top: 14px; font-size: 9px; color: #999; }
    </style>
    <h1>Mediciones</h1>
    <p class="sub">Exportado de Stelar</p>
    <table>${headRow}${bodyRows}</table>
    <p class="foot">Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.</p>`

  const { uri } = await Print.printToFileAsync({ html })
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Tus mediciones',
    UTI: 'com.adobe.pdf',
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
