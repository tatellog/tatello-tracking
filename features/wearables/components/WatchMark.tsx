/*
 * La marca de procedencia pegada al DATO (dueña 28 sep 2026): un reloj chico en
 * niebla justo después de "Dormiste 8 h 39" o "Entrenaste hoy · 45 min". Antes
 * la procedencia era un encabezado en mayúsculas sobre el bloque ("SUEÑO DESDE
 * TU SMARTWATCH · HACE UN RATO") y competía con las filas. El "hace un rato"
 * vive en la etiqueta de accesibilidad, no en pantalla.
 */
import { View } from 'react-native'

import { colors } from '@/theme'

import { useWearableLastSync } from '../hooks'
import { relativeSyncLabel } from '../recovery'
import { WatchGlyph } from './WatchGlyph'

export function WatchMark({ past = false }: { past?: boolean }) {
  const lastSyncAt = useWearableLastSync()
  const when = past ? null : relativeSyncLabel(lastSyncAt, new Date())
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`De tu smartwatch${when ? `, sincronizado ${when}` : ''}`}
      style={{ marginLeft: 6 }}
    >
      <WatchGlyph color={colors.niebla} size={13} />
    </View>
  )
}
