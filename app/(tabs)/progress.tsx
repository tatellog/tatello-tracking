import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  EmptyState,
  HeroStat,
  RangeChips,
  WeightChart,
  type RangeKey,
} from '@/features/progress/components'
import { useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  toWeightPoints,
} from '@/features/progress/logic'
import { colors, radius, shadows, spacing, typography } from '@/theme'

const RANGE_DAYS: Record<RangeKey, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
}

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': '7 días',
  '30d': '30 días',
  '90d': '90 días',
  all: 'Todo el historial',
}

export default function ProgressScreen() {
  const router = useRouter()
  const [range, setRange] = useState<RangeKey>('30d')
  const measurementsQuery = useMeasurements(RANGE_DAYS[range])

  const points = toWeightPoints(measurementsQuery.data ?? [])
  const last = points[points.length - 1]
  const delta = computeDelta(points)
  const trend = computeTrend(points)
  const trendCopy = trend ? formatTrendCopy(trend) : null

  const onAddMeasurement = () => router.push('/log-measurement')

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.heading}>TU PESO</Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(300).delay(80)}>
          <RangeChips value={range} onChange={setRange} />
        </Animated.View>

        {points.length >= 2 && last ? (
          <>
            <Animated.View entering={FadeIn.duration(400).delay(160)}>
              <View style={styles.card}>
                <HeroStat weight={last.weight} delta={delta} rangeLabel={RANGE_LABEL[range]} />
                <View style={styles.divider} />
                <WeightChart points={points} />
                {trendCopy && <Text style={styles.trendCopy}>{trendCopy}</Text>}
              </View>
            </Animated.View>

            <Animated.View entering={FadeIn.duration(400).delay(280)}>
              <Text style={styles.addLink} accessibilityRole="link" onPress={onAddMeasurement}>
                Agregar otra medida
              </Text>
            </Animated.View>
          </>
        ) : points.length === 1 && last ? (
          <Animated.View entering={FadeIn.duration(400).delay(160)}>
            <View style={styles.card}>
              <HeroStat weight={last.weight} delta={null} rangeLabel={RANGE_LABEL[range]} />
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState measurementCount={1} onAdd={onAddMeasurement} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(400).delay(160)}>
            <EmptyState measurementCount={0} onAdd={onAddMeasurement} />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  heading: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  card: {
    backgroundColor: colors.pearlElevated,
    borderColor: colors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  divider: {
    height: 0,
    borderTopWidth: 0.6,
    borderTopColor: colors.borderDashed,
    borderStyle: 'dashed',
    marginVertical: spacing.xs,
  },
  trendCopy: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    fontWeight: typography.fontWeight.medium,
    color: colors.inkPrimary,
    textAlign: 'center',
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    marginTop: spacing.sm,
  },
  addLink: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.bodyLoose,
    color: colors.mauveDeep,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
})
