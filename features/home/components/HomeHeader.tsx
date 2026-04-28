import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Single-line uppercase 'WEEKDAY · DAY MONTH' (e.g. 'SÁBADO · 23
 * ABRIL') derived from the device's local clock, plus the day/night
 * toggle placeholder on the right (non-functional until a real dark
 * mode lands).
 *
 * Date is read from `new Date()` at render time so the masthead
 * stays current as the day rolls over — `useDayRollover` upstream
 * invalidates the brief, which re-renders this component.
 */
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

/*
 * 'SÁBADO · 23 ABRIL' in es-MX. We pull weekday and month names
 * separately and uppercase them rather than calling toLocaleDateString
 * once because the ICU `long` format inserts comma + 'de' joiners
 * ('sábado, 23 de abril') that we don't want in the masthead.
 */
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
