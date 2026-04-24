import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { colors, spacing, typography } from '@/theme'

const MINUS = '−'

function formatSigned(n: number): string {
  if (n > 0) return `+${n.toFixed(1).replace(/\.0$/, '')}`
  if (n < 0) return `${MINUS}${Math.abs(n).toFixed(1).replace(/\.0$/, '')}`
  return '0'
}

type Props = {
  weightDeltaKg?: number
  waistDeltaCm?: number
  periodWeeks?: number
}

/*
 * Two deltas side-by-side with a soft vertical gradient divider.
 *
 * When there's no measurement from ~30 days ago the component
 * flips to an empty-state line inviting the user to log their
 * first measurement. The numbers-first layout is only meaningful
 * with a comparison point; showing a standalone "−0 kg" would
 * read as broken, not empty.
 *
 * The whole row micro-pulses on a 4.5 s cadence (scale 1 → 1.025
 * → 1 → hold) starting 2.5 s after mount so the cascade has
 * finished before anything moves on its own.
 */
export function DeltaPair({ weightDeltaKg, waistDeltaCm, periodWeeks = 4 }: Props) {
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  useEffect(() => {
    scale.value = withDelay(
      2500,
      withRepeat(
        withSequence(
          withTiming(1.025, { duration: 900, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 2700, easing: Easing.linear }),
        ),
        -1,
        false,
      ),
    )
  }, [scale])

  if (weightDeltaKg === undefined && waistDeltaCm === undefined) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Agrega tu primera medida</Text>
      </View>
    )
  }

  return (
    <Animated.View style={[styles.row, animStyle]}>
      <DeltaColumn value={weightDeltaKg} unit="kg" label="peso" periodWeeks={periodWeeks} />
      <LinearGradient
        colors={['transparent', colors.goldDivider, 'transparent']}
        style={styles.divider}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <DeltaColumn value={waistDeltaCm} unit="cm" label="cintura" periodWeeks={periodWeeks} />
    </Animated.View>
  )
}

type DeltaColumnProps = {
  value: number | undefined
  unit: 'kg' | 'cm'
  label: string
  periodWeeks: number
}

function DeltaColumn({ value, unit, label, periodWeeks }: DeltaColumnProps) {
  if (value === undefined) {
    return <View style={styles.column} />
  }
  return (
    <View style={styles.column}>
      <View style={styles.valueRow}>
        <Text style={styles.valueNumber}>{formatSigned(value)}</Text>
        <Text style={styles.valueUnit}>{unit}</Text>
      </View>
      <Text style={styles.label}>
        {label} · {periodWeeks} sem
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 0.5,
    alignSelf: 'stretch',
    marginVertical: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueNumber: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.delta,
    color: colors.forestDeep,
    letterSpacing: typography.letterSpacing.display,
  },
  valueUnit: {
    fontSize: typography.sizes.body,
    color: colors.goldBurnt,
    marginLeft: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldSoft,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.prose,
    color: colors.goldBurnt,
    fontStyle: 'italic',
  },
})
