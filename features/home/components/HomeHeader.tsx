import { Feather } from '@expo/vector-icons'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/theme'

type Props = {
  dayOfWeek: string
  date: string // 'YYYY-MM-DD' in America/Mexico_City
}

const MONTHS_ES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
] as const

/*
 * 'YYYY-MM-DD' → '23 ABRIL'. Parses components manually so the render
 * doesn't depend on `new Date('YYYY-MM-DD')` (which is UTC midnight
 * and can drift a day for users west of UTC).
 */
function formatDateEs(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS_ES[m - 1]}`
}

/* 24-hour HH:MM in the device's local tz — matches the masthead convention. */
function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/*
 * Top-left: WEEKDAY · DATE + HH:MM under it.
 * Top-right: a day/night toggle placeholder — non-functional in
 * Sprint 2 (dark mode is post-MVP); rendered so the composition
 * matches the mockup and the future toggle has a slot.
 */
export function HomeHeader({ dayOfWeek, date }: Props) {
  const now = useMemo(() => new Date(), [])
  const time = formatTime(now)
  const heading = `${dayOfWeek.toUpperCase()} · ${formatDateEs(date)}`

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      <Pressable accessibilityLabel="Cambiar tema" style={styles.toggle}>
        <Feather name="moon" size={14} color={colors.inkPrimary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
    fontWeight: '600',
  },
  time: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelDim,
    marginTop: spacing.xs,
  },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.pearlMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.borderDashed,
  },
})
