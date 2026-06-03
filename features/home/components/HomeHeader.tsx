import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

export function HomeHeader() {
  const heading = formatHeadingEs(new Date())

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>{heading}</Text>
      <Pressable accessibilityLabel="Cambiar tema" style={styles.toggle}>
        <Feather name="moon" size={14} color={colors.inkPrimary} />
      </Pressable>
    </View>
  )
}

function formatHeadingEs(now: Date): string {
  const weekday = now.toLocaleDateString('es-MX', { weekday: 'long' }).toUpperCase()
  const month = now.toLocaleDateString('es-MX', { month: 'long' }).toUpperCase()
  return `${weekday} · ${now.getDate()} ${month}`
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pearlMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
})
