/*
 * La marca de procedencia pegada al DATO (dueña 28 sep 2026): un reloj chico en
 * niebla justo después de "Dormiste 8 h 39" o "Entrenaste hoy · 45 min". Antes
 * la procedencia era un encabezado en mayúsculas sobre el bloque ("SUEÑO DESDE
 * TU SMARTWATCH · HACE UN RATO") y competía con las filas. El "hace un rato"
 * vive en la etiqueta de accesibilidad, no en pantalla.
 *
 * Tocarlo abre "Tu smartwatch" (dueña 29 sep 2026): todo lo que viene del reloj
 * lleva esta marca y desde cualquiera se llega al detalle.
 */
import { useRouter } from 'expo-router'
import { Pressable } from 'react-native'

import { colors } from '@/theme'

import { useWearableLastSync } from '../hooks'
import { relativeSyncLabel } from '../recovery'
import { WatchGlyph } from './WatchGlyph'

export function WatchMark({
  past = false,
  size = 13,
  inline = true,
}: {
  past?: boolean
  size?: number
  /** Pegado a un dato (con aire a la izquierda). false = sin margen. */
  inline?: boolean
}) {
  const router = useRouter()
  const lastSyncAt = useWearableLastSync()
  const when = past ? null : relativeSyncLabel(lastSyncAt, new Date())
  return (
    <Pressable
      onPress={() => router.push('/smartwatch')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`De tu smartwatch${when ? `, sincronizado ${when}` : ''}. Ver lo que trajo tu smartwatch.`}
      style={({ pressed }) => [inline && { marginLeft: 6 }, pressed && { opacity: 0.6 }]}
    >
      <WatchGlyph color={colors.niebla} size={size} />
    </Pressable>
  )
}
