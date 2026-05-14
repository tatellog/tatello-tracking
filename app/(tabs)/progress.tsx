import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  toWeightPoints,
  type WeightPoint,
} from '@/features/progress/logic'
import { PrimaryCta, TabHeader } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

type Period = '7D' | '30D' | '90D' | 'TODO'

const PERIOD_DAYS: Record<Period, number | null> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  TODO: null,
}

const PERIOD_LABEL: Record<Period, string> = {
  '7D': '7',
  '30D': '30',
  '90D': '90',
  TODO: '∞',
}

const PERIOD_UNIT: Record<Period, string> = {
  '7D': 'días',
  '30D': 'días',
  '90D': 'días',
  TODO: 'todo',
}

export default function ProgressScreen() {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('30D')
  const measurementsQuery = useMeasurements(PERIOD_DAYS[period])

  const points = useMemo(
    () => toWeightPoints(measurementsQuery.data ?? []),
    [measurementsQuery.data],
  )
  const delta = useMemo(() => computeDelta(points), [points])
  const trend = useMemo(() => computeTrend(points), [points])

  const first = points[0]
  const last = points[points.length - 1]
  const measurementCount = points.length

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(280)}>
          <TabHeader
            title="Tu cambio"
            titleEmphasis="Tu"
            pillLabel={`${PERIOD_LABEL[period]} ${PERIOD_UNIT[period]}`}
            pillEmphasis={PERIOD_LABEL[period]}
          />
        </Animated.View>

        <Animated.View entering={FadeIn.duration(320).delay(80)} style={styles.deltaBlock}>
          <Text style={styles.deltaLabel}>Tu cambio · {PERIOD_UNIT[period]}</Text>
          <View style={styles.deltaNumRow}>
            <Text style={styles.deltaNum}>{formatDelta(delta?.abs)}</Text>
            <Text style={styles.deltaUnit}>kg</Text>
          </View>
          {first && last && first !== last ? (
            <Text style={styles.deltaRange}>
              de <Text style={styles.deltaRangeStrong}>{first.weight.toFixed(1)}</Text> a{' '}
              <Text style={styles.deltaRangeStrong}>{last.weight.toFixed(1)} kg</Text>
            </Text>
          ) : (
            <Text style={styles.deltaRange}>
              {points.length === 0
                ? 'Sin mediciones en este rango.'
                : 'Una sola medición — añade otra para ver el cambio.'}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(320).delay(160)} style={styles.periods}>
          {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, p === period && styles.periodBtnOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: p === period }}
            >
              <Text style={[styles.periodLabel, p === period && styles.periodLabelOn]}>{p}</Text>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(360).delay(240)} style={styles.chartCard}>
          <Text style={styles.chartLabel}>Trayectoria · banda de tolerancia ±0.3 kg</Text>
          {points.length >= 2 ? (
            <TrajectoryChart points={points} />
          ) : (
            <View style={styles.chartEmpty}>
              <Text style={styles.chartEmptyText}>
                Necesitas al menos 2 mediciones para trazar la curva.
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.duration(360).delay(320)} style={styles.statsRow}>
          <StatCard label="Mediciones" value={`${measurementCount}`} />
          <StatCard
            label="Promedio"
            value={
              trend ? `${trend.weeklyChange > 0 ? '+' : ''}${trend.weeklyChange.toFixed(2)}` : '—'
            }
            valueColor={trend && trend.direction === 'down' ? colors.magenta : colors.leche}
          />
          <StatCard
            label="Próximo"
            value={
              trend
                ? `${trend.weeklyChange > 0 ? '+' : ''}${(trend.weeklyChange * 4).toFixed(1)}`
                : '—'
            }
          />
        </Animated.View>

        <Animated.View entering={FadeIn.duration(360).delay(400)} style={styles.ctaWrap}>
          <PrimaryCta label="+ Nueva medición →" onPress={() => router.push('/log-measurement')} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

function formatDelta(kg: number | undefined): string {
  if (kg == null) return '—'
  if (kg === 0) return '0.0'
  const sign = kg < 0 ? '−' : '+'
  return `${sign}${Math.abs(kg).toFixed(1)}`
}

/* ────────────────────────────────────────────────────────────────── */

type ChartProps = {
  points: readonly WeightPoint[]
}

// X-axis is the ordinal index of measurements, not real time —
// otherwise two same-day measurements would collapse to one tick.
function TrajectoryChart({ points }: ChartProps) {
  const W = 280
  const H = 130
  const padX = 12
  const padY = 14

  const ys = points.map((p) => p.weight)
  const minY = Math.min(...ys) - 0.6
  const maxY = Math.max(...ys) + 0.6
  const lastX = points.length - 1

  const sx = (i: number) => padX + (i / Math.max(1, lastX)) * (W - 2 * padX)
  const sy = (y: number) => padY + ((maxY - y) / (maxY - minY)) * (H - 2 * padY)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.weight)}`).join(' ')
  const upperPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.weight + 0.3)}`)
    .join(' ')
  const lowerPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.weight - 0.3)}`)
    .join(' ')

  const bandPath = `${upperPath} L ${sx(lastX)} ${sy((points[lastX]?.weight ?? 0) - 0.3)} ${points
    .slice()
    .reverse()
    .map((p, i) => `L ${sx(lastX - i)} ${sy(p.weight - 0.3)}`)
    .join(' ')} Z`

  const endX = sx(lastX)
  const endY = sy(points[lastX]?.weight ?? 0)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="rgba(233,30,99,0.18)" />
          <Stop offset="100%" stopColor="rgba(233,30,99,0.04)" />
        </LinearGradient>
      </Defs>

      <Path d={bandPath} fill="url(#bandGrad)" stroke="none" />
      <Path
        d={upperPath}
        fill="none"
        stroke="rgba(244,236,222,0.15)"
        strokeWidth={0.7}
        strokeDasharray="3 3"
      />
      <Path
        d={lowerPath}
        fill="none"
        stroke="rgba(244,236,222,0.15)"
        strokeWidth={0.7}
        strokeDasharray="3 3"
      />

      <Path
        d={linePath}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={endX} cy={endY} r={5} fill={colors.magenta} />
      <Circle cx={endX} cy={endY} r={10} fill="none" stroke="rgba(233,30,99,0.5)" strokeWidth={1} />
    </Svg>
  )
}

/* ────────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  deltaBlock: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  deltaLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  deltaNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  deltaNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 80,
    lineHeight: 74,
    color: colors.magenta,
    letterSpacing: -5,
  },
  deltaUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.bone,
  },
  deltaRange: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
  },
  deltaRangeStrong: {
    fontFamily: typography.displayHeavy,
    fontStyle: 'normal',
    color: colors.leche,
    fontSize: 16,
  },
  periods: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 4,
    padding: 3,
    gap: 3,
    marginTop: 18,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    height: 38,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  periodBtnOn: {
    backgroundColor: colors.magenta,
  },
  periodLabel: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  periodLabelOn: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 6,
    padding: 14,
  },
  chartLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 12,
  },
  chartEmpty: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.bone,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9,
    color: colors.niebla,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValue: {
    fontFamily: typography.displayHeavy,
    fontSize: 22,
    color: colors.leche,
    letterSpacing: -0.9,
    lineHeight: 22,
  },
  ctaWrap: {
    marginTop: 14,
  },
})
