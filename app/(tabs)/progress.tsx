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

        {points.length >= 1 ? (
          <Animated.View entering={FadeIn.duration(400).delay(360)} style={styles.recentBlock}>
            <Text style={styles.recentLabel}>ÚLTIMAS MEDIDAS</Text>
            <View style={styles.recentList}>
              {[...points]
                .reverse()
                .slice(0, 5)
                .map((p, idx) => (
                  <View key={p.t} style={styles.recentRow}>
                    <Text style={styles.recentWeight}>{p.weight.toFixed(1)} kg</Text>
                    <Text style={styles.recentDate}>{formatRecentDate(new Date(p.t))}</Text>
                    {idx === 0 ? <Text style={styles.recentBadge}>Reciente</Text> : null}
                  </View>
                ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function formatRecentDate(d: Date): string {
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`
  return `${d.getDate()} ${months[d.getMonth()] ?? ''}`
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
  recentBlock: {
    gap: spacing.sm,
  },
  recentLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  recentList: {
    backgroundColor: colors.pearlElevated,
    borderColor: colors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.tile,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  recentWeight: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.inkPrimary,
    letterSpacing: -0.3,
    minWidth: 72,
  },
  recentDate: {
    flex: 1,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.labelMuted,
  },
  recentBadge: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
  },
})
