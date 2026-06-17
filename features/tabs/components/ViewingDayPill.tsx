/*
 * ViewingDayPill — el indicador PERSISTENTE de "modo ver día". Vive en el tab
 * bar (global, fuera de Hoy), así que avisa desde CUALQUIER tab que Hoy está
 * anclado a un día pasado — y que tu próximo "Registrar" caerá ahí. Toca para
 * volver a hoy.
 *
 * Tono ORO tenue a propósito (no magenta, no rojo, sin ⚠): es un día pasado que
 * revisas/completas, un recuerdo — cálido, no una alarma (manifiesto v3.0).
 * Lee `useActiveLogDate()`; null = hoy → no se monta.
 */
import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated'

import { requestReturnToToday, useActiveLogDate } from '@/features/tabs/active-log-date'
import { colors, typography } from '@/theme'

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function dayLabel(iso: string): string {
  const d = Number(iso.slice(8, 10))
  const m = MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''
  return `${d} de ${m}`
}

export function ViewingDayPill() {
  const activeLogDate = useActiveLogDate()
  if (!activeLogDate) return null

  return (
    <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOut.duration(160)}>
      <Pressable
        style={styles.pill}
        onPress={requestReturnToToday}
        accessibilityRole="button"
        accessibilityLabel={`Estás viendo el ${dayLabel(activeLogDate)}. Toca para volver a hoy.`}
      >
        <Feather name="moon" size={13} color={colors.oroLeche} />
        <Text style={styles.text} numberOfLines={1}>
          Estás en el <Text style={styles.date}>{dayLabel(activeLogDate)}</Text>
        </Text>
        <Text style={styles.back}>Volver a hoy ›</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  date: {
    fontFamily: typography.uiBold,
    color: colors.oroLeche,
    textTransform: 'capitalize',
  },
  back: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magenta,
  },
})
