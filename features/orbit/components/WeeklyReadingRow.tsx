/*
 * La Lectura Semanal en Descubre (ST-010 · H12): una fila corta para abrirla
 * o volver a leerla mientras la semana pasada tenga lectura. Antes vivía en
 * Órbita › Semana, que dejó de montarse con el feed de un solo scroll, y la
 * tarjeta de Hoy se va al abrirla: no había forma de releerla. Sin ✦: la
 * Lectura es determinística. Mismo gate que toda la Lectura (dev + beta).
 */
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import { useWeeklyReadingAvailability, useWeeklyReadingOn } from '../weekly-reading-hooks'

export function WeeklyReadingRow() {
  const router = useRouter()
  const readingOn = useWeeklyReadingOn()
  const weekly = useWeeklyReadingAvailability(readingOn)
  if (!weekly.available) return null
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.push('/weekly-reading')}
        accessibilityRole="button"
        accessibilityLabel="Tu lectura de la semana. Ábrela."
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
      >
        <View style={styles.text}>
          <Text style={styles.title}>Tu lectura de la semana</Text>
          <Text style={styles.line}>Lo que tu semana pasada dejó ver.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bgCard,
  },
  text: { flex: 1, gap: 3 },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  line: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  chevron: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    color: colors.magenta,
  },
})
