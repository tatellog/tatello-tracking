/*
 * La entrada fija a "Tu smartwatch" en Hoy (dueña 29 sep 2026): una fila quieta
 * bajo el check-in, en el lugar donde vivía la invitación a conectar. Solo con
 * el reloj conectado; dice cuándo sincronizó y abre el detalle de todo lo que
 * trajo Salud. Nunca muestra números (el peso no vive en Hoy).
 */
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors, typography } from '@/theme'

import { useAppleHealthConnection } from '../hooks'
import { relativeSyncLabel } from '../recovery'
import { WatchGlyph } from './WatchGlyph'

export function SmartwatchRow() {
  const router = useRouter()
  const { connected, lastSyncAt } = useAppleHealthConnection()
  if (connected !== true) return null
  const when = relativeSyncLabel(lastSyncAt, new Date())
  const label = `Desde tu smartwatch${when ? ` · sincronizado ${when}` : ''}`

  return (
    <Pressable
      onPress={() => router.push('/smartwatch')}
      hitSlop={{ top: 10, bottom: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Ver lo que trajo tu reloj y tu báscula.`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <WatchGlyph color={colors.niebla} size={13} />
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    marginLeft: 2,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.7 },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
})
