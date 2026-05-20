import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { BeforeAfterPhotos } from '@/features/progress/components/BeforeAfterPhotos'
import { TrainingShareCTA } from '@/features/progress/components/TrainingShareCTA'
import { useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  toWeightPoints,
  type Trend,
  type WeightPoint,
} from '@/features/progress/logic'
import { PrimaryCta, SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

type Period = '7D' | '30D' | '90D' | 'TODO'

const PERIOD_DAYS: Record<Period, number | null> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  TODO: null,
}

// 4-point star — the shared glyph; here it marks the trajectory origin.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

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
  const count = points.length

  return (
    <View style={styles.screen}>
      <SkyBackground />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(280)}>
            <TabHeader title="Tu cambio" titleEmphasis="Tu" />
          </Animated.View>

          {/* Hero — the change, the brightest star in the page's sky. */}
          <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.hero}>
            <EyebrowLabel tone="niebla" size={10} style={styles.heroEyebrow}>
              Rumbo a tu Andrómeda
            </EyebrowLabel>
            <View style={styles.deltaRow}>
              <Text style={styles.deltaNum}>{formatDelta(delta?.abs)}</Text>
              {delta ? <Text style={styles.deltaUnit}>kg</Text> : null}
            </View>
            <Text style={styles.deltaRange}>
              {count === 0 ? (
                'Aún no marcas tu trayectoria.'
              ) : count === 1 && first ? (
                <>
                  Tu primera marca —{' '}
                  <Text style={styles.deltaStrong}>{first.weight.toFixed(1)} kg</Text>
                </>
              ) : first && last ? (
                <>
                  <Text style={styles.deltaStrong}>{first.weight.toFixed(1)}</Text> →{' '}
                  <Text style={styles.deltaStrong}>{last.weight.toFixed(1)} kg</Text>
                </>
              ) : null}
            </Text>
          </Animated.View>

          {/* Period — a stadium pill, matching the quick-log selector. */}
          <Animated.View entering={FadeIn.duration(320).delay(160)} style={styles.periodPill}>
            {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => {
              const on = p === period
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[styles.periodSeg, on && styles.periodSegOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.periodLabel, on && styles.periodLabelOn]}>{p}</Text>
                </Pressable>
              )
            })}
          </Animated.View>

          {/* Trajectory — no box; the line floats in the page's sky,
            crossing the same starfield as everything else. */}
          <Animated.View entering={FadeIn.duration(360).delay(240)} style={styles.chartSection}>
            {count >= 1 ? (
              <Text style={styles.chartCaption}>
                {count} {count === 1 ? 'medición' : 'mediciones'}
              </Text>
            ) : null}
            {points.length >= 2 ? (
              <TrajectoryChart points={points} trend={trend} />
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={styles.chartEmptyText}>
                  {count === 1
                    ? 'Una segunda marca traza tu trayectoria.'
                    : 'Marca tu peso para empezar a trazar tu trayectoria.'}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* The pace — in the coach's voice. */}
          {trend ? (
            <Animated.View entering={FadeIn.duration(360).delay(320)}>
              <Text style={styles.coachLine}>{formatTrendCopy(trend)}</Text>
            </Animated.View>
          ) : null}

          {/* Entreno de hoy — ephemeral capture-and-share, only when
              the user has marked today as trained. Lives above the
              antes/después since "recent" reads before "longitudinal". */}
          <TrainingShareCTA />

          {/* Antes y ahora — the trajectory, made visible. */}
          <BeforeAfterPhotos />

          <Animated.View entering={FadeIn.duration(360).delay(400)} style={styles.ctaWrap}>
            <PrimaryCta label="Nueva medición" onPress={() => router.push('/log-measurement')} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
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
  trend: Trend | null
}

/*
 * The trajectory. X-axis is the ordinal index of measurements, not
 * real time — two same-day measurements must not collapse to one tick.
 *
 * Read as a constellation forming: the measurement stars sit in the
 * sky, the comet line draws itself between them on mount, the current
 * weight blazes as the comet head, and — with enough points for a
 * trend — a dashed line projects the pace forward.
 */
function TrajectoryChart({ points, trend }: ChartProps) {
  const W = 300
  const H = 188
  const padX = 18
  const padY = 26

  const lastIdx = points.length - 1
  const last = points[lastIdx]
  const first = points[0]
  const hasProjection = trend != null && last != null

  // Reserve the right slice of the chart for the forward projection.
  const histEndX = hasProjection ? padX + (W - 2 * padX) * 0.64 : W - padX
  const projectedWeight = hasProjection ? last.weight + trend.weeklyChange * 4 : null

  const ys = points.map((p) => p.weight)
  const domainYs = projectedWeight != null ? [...ys, projectedWeight] : ys
  const minY = Math.min(...domainYs) - 0.7
  const maxY = Math.max(...domainYs) + 0.7

  const sx = (i: number) => padX + (i / Math.max(1, lastIdx)) * (histEndX - padX)
  const sy = (y: number) => padY + ((maxY - y) / (maxY - minY)) * (H - 2 * padY)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.weight)}`).join(' ')

  // Total polyline length — drives the stroke draw-in.
  let lineLen = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) continue
    lineLen += Math.hypot(sx(i) - sx(i - 1), sy(b.weight) - sy(a.weight))
  }
  lineLen = lineLen || 1

  const draw = useSharedValue(0)
  useEffect(() => {
    draw.value = 0
    draw.value = withDelay(150, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }))
  }, [points, draw])

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLen * (1 - draw.value),
  }))
  const revealProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.62, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const originK = 12 / 24
  const ox = sx(0)
  const oy = sy(first?.weight ?? 0)
  const hx = sx(lastIdx)
  const hy = sy(last?.weight ?? 0)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        {/* Comet gradient — deep magenta tail receding into the bright
            head, so the line itself carries depth. */}
        <SvgGradient id="comet" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.magentaDeep} />
          <Stop offset="1" stopColor={colors.magentaHot} />
        </SvgGradient>
      </Defs>

      {/* Measurement stars — each logged weight, a point of light. */}
      {points.slice(1, lastIdx).map((p, i) => (
        <Circle key={`m${i}`} cx={sx(i + 1)} cy={sy(p.weight)} r={2.6} fill={colors.magenta} />
      ))}

      {/* Origin — a faint star marking where the trajectory began. */}
      <Path
        d={STAR_PATH}
        transform={[
          { translateX: ox - 12 * originK },
          { translateY: oy - 12 * originK },
          { scale: originK },
        ]}
        fill={colors.magentaDeep}
      />

      {/* The trajectory — a comet, drawing itself in on mount. */}
      <AnimatedPath
        d={linePath}
        fill="none"
        stroke="url(#comet)"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={lineLen}
        animatedProps={lineProps}
      />

      {/* Comet head + forward projection — revealed once the line lands. */}
      <AnimatedG animatedProps={revealProps}>
        {hasProjection && projectedWeight != null ? (
          <>
            <Path
              d={`M ${hx} ${hy} L ${W - padX} ${sy(projectedWeight)}`}
              stroke={colors.magentaDeep}
              strokeWidth={1.8}
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
            <Circle
              cx={W - padX}
              cy={sy(projectedWeight)}
              r={4.5}
              fill="none"
              stroke={colors.magentaDeep}
              strokeWidth={1.6}
            />
          </>
        ) : null}
        <Circle cx={hx} cy={hy} r={13} fill={colors.magentaTint2} />
        <Circle cx={hx} cy={hy} r={5.5} fill={colors.magentaHot} />
      </AnimatedG>
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  hero: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  heroEyebrow: {
    marginBottom: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  deltaNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 80,
    // Hanken Black at 80 px draws ink beyond the font's own metrics;
    // iOS clips that overshoot to the Text frame. lineHeight can't fix
    // it — padding can: it enlarges the frame so the ink has room.
    paddingTop: 14,
    paddingBottom: 12,
    color: colors.magenta,
    letterSpacing: -3,
  },
  deltaUnit: {
    fontFamily: typography.displayMedium,
    fontSize: 21,
    color: colors.bone,
  },
  deltaRange: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.bone,
  },
  deltaStrong: {
    fontFamily: typography.displaySemi,
    fontSize: 15,
    color: colors.leche,
  },
  // Stadium pill — mirrors the quick-log meal-slot selector.
  periodPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 22,
    padding: 4,
    marginTop: 22,
    marginBottom: 16,
  },
  periodSeg: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegOn: {
    backgroundColor: colors.magentaTint2,
  },
  periodLabel: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.niebla,
    letterSpacing: 1.4,
  },
  periodLabelOn: {
    color: colors.magentaHot,
  },
  // No box — the trajectory floats directly in the page's sky.
  chartSection: {
    marginTop: 4,
  },
  chartCaption: {
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.niebla,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  chartEmpty: {
    paddingVertical: 26,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
  },
  // The pace, read aloud — the only serif-italic line: the coach voice.
  coachLine: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.bone,
  },
  ctaWrap: {
    marginTop: 18,
  },
})
