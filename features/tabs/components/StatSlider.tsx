import { curveMonotoneX, line as d3Line } from 'd3-shape'
import * as Haptics from 'expo-haptics'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, Path, Rect } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BriefContext } from '@/features/brief/api'
import { useMeasurements } from '@/features/progress/hooks'
import { toWeightPoints, type WeightPoint } from '@/features/progress/logic'
import { useSetWater, useWaterToday } from '@/features/water/hooks'
import { colors, typography } from '@/theme'

import { RingCard } from './RingCard'

const SLIDE_TITLES = ['Macros de hoy', 'Tu peso', 'Agua de hoy'] as const
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

type Props = { ctx: BriefContext }

/**
 * The Hoy-tab stat slider — a paged carousel whose section title
 * changes per slide. Slide 1 is today's macros (protein + calories),
 * slide 2 is the weight trend. Pagination dots track the position;
 * the title cross-fades as the slider pages.
 */
export function StatSlider({ ctx }: Props) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(0)

  // Live scroll offset — drives the per-slide enter/leave animation.
  const scrollX = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== width) setWidth(w)
  }

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return
    const idx = Math.round(e.nativeEvent.contentOffset.x / width)
    if (idx !== active && idx >= 0 && idx < SLIDE_TITLES.length) setActive(idx)
  }

  return (
    <View onLayout={onLayout}>
      <View style={styles.header}>
        {/* Re-keyed on `active` so the title cross-fades when paging. */}
        <Animated.View key={active} entering={FadeIn.duration(280)}>
          <EyebrowLabel tone="magenta">{SLIDE_TITLES[active] ?? ''}</EyebrowLabel>
        </Animated.View>
      </View>

      {width > 0 ? (
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <Slide index={0} width={width} scrollX={scrollX}>
            <MacroSlide ctx={ctx} />
          </Slide>
          <Slide index={1} width={width} scrollX={scrollX}>
            <WeightSlide ctx={ctx} />
          </Slide>
          <Slide index={2} width={width} scrollX={scrollX}>
            <WaterSlide date={ctx.date} />
          </Slide>
        </Animated.ScrollView>
      ) : (
        <View style={styles.measurePlaceholder} />
      )}

      <Dots count={SLIDE_TITLES.length} active={active} />
    </View>
  )
}

/* Each slide breathes as the carousel pages: a slide off-centre
 * fades and scales down a touch, the centred one sits full. The
 * effect is tied straight to the scroll offset, so it tracks the
 * finger left and right rather than only snapping at the end. */
function Slide({
  index,
  width,
  scrollX,
  children,
}: {
  index: number
  width: number
  scrollX: SharedValue<number>
  children: ReactNode
}) {
  const style = useAnimatedStyle(() => {
    const d = width > 0 ? scrollX.value / width - index : 0
    return {
      opacity: interpolate(d, [-1, 0, 1], [0.5, 1, 0.5], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [-1, 0, 1], [0.94, 1, 0.94], Extrapolation.CLAMP) }],
    }
  })
  return <Animated.View style={[{ width }, style]}>{children}</Animated.View>
}

/* ─── Slide 1 — today's macros ─────────────────────────────────────── */

function MacroSlide({ ctx }: { ctx: BriefContext }) {
  if (!ctx.targets) {
    return (
      <View style={[styles.slide, styles.emptyCard]}>
        <Text style={styles.emptyText}>Configura tus metas para ver tus macros.</Text>
      </View>
    )
  }
  // Calories use a "budget remaining" model — start full, count down.
  const caloriesRemaining = Math.max(0, ctx.targets.calories - ctx.today_macros.calories)
  return (
    <View style={[styles.slide, styles.macroRow]}>
      <RingCard
        label="Proteína"
        value={ctx.today_macros.protein_g}
        target={ctx.targets.protein_g}
        formatted={Math.round(ctx.today_macros.protein_g).toString()}
        unitSuffix={`/ ${ctx.targets.protein_g} g`}
        ringColor={colors.magenta}
        ringDelay={400}
      />
      <RingCard
        budget
        label="Calorías"
        value={caloriesRemaining}
        target={ctx.targets.calories}
        formatted={Math.round(caloriesRemaining).toString()}
        unitSuffix="kcal restantes"
        ringColor={colors.bone}
        ringDelay={600}
        small
      />
    </View>
  )
}

/* ─── Slide 2 — weight trend ───────────────────────────────────────── */

function fmtDelta(d: number): string {
  const sign = d < 0 ? '−' : d > 0 ? '+' : ''
  return `${sign}${Math.abs(d).toFixed(1)} kg`
}

function WeightSlide({ ctx }: { ctx: BriefContext }) {
  const { data: measurements } = useMeasurements(90)

  const points = useMemo<WeightPoint[]>(
    () => (measurements ? toWeightPoints(measurements) : []),
    [measurements],
  )

  const latest = points[points.length - 1]
  const first = points[0]
  const current = latest?.weight ?? ctx.latest_measurement?.weight_kg ?? null

  // Total change since the first logged measurement.
  const totalDelta = latest && first && points.length >= 2 ? latest.weight - first.weight : null

  // Weekly delta — latest vs the measurement closest to 7 days back.
  const weekDelta = useMemo<number | null>(() => {
    if (!latest || points.length < 2) return null
    const target = latest.t - WEEK_MS
    let ref: WeightPoint | null = null
    for (const p of points) {
      if (p === latest) continue
      if (ref == null || Math.abs(p.t - target) < Math.abs(ref.t - target)) ref = p
    }
    return ref ? latest.weight - ref.weight : null
  }, [points, latest])

  if (current == null) {
    return (
      <View style={[styles.slide, styles.emptyCard]}>
        <Text style={styles.emptyText}>Registra tu peso para ver tu tendencia aquí.</Text>
      </View>
    )
  }

  return (
    <View style={styles.slide}>
      <View style={styles.card}>
        <View style={styles.weightRow}>
          {points.length >= 2 ? (
            <WeightSparkline points={points} />
          ) : (
            <View style={styles.sparkPlaceholder} />
          )}
          <View style={styles.numberStack}>
            <View style={styles.weightTop}>
              <Text
                style={styles.weightValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {current.toFixed(1)}
              </Text>
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            {totalDelta != null ? (
              <Text style={[styles.totalLine, totalDelta < 0 && styles.deltaGood]}>
                {fmtDelta(totalDelta)} desde el inicio
              </Text>
            ) : (
              <Text style={styles.weeklyLine}>aún sin tendencia</Text>
            )}
            {weekDelta != null ? (
              <Text style={styles.weeklyLine}>{fmtDelta(weekDelta)} esta semana</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}

const SPARK_W = 130
const SPARK_H = 64
const SPARK_PAD = 7

/* Compact weight trend — a monotone magenta line with the current
 * weight marked by a dot at the tip. */
function WeightSparkline({ points }: { points: WeightPoint[] }) {
  const ts = points.map((p) => p.t)
  const ws = points.map((p) => p.weight)
  const tMin = Math.min(...ts)
  const tMax = Math.max(...ts)
  const wMin = Math.min(...ws)
  const wMax = Math.max(...ws)
  const tSpan = Math.max(1, tMax - tMin)
  const wSpan = Math.max(0.1, wMax - wMin)
  const x = (t: number) => SPARK_PAD + ((t - tMin) / tSpan) * (SPARK_W - 2 * SPARK_PAD)
  const y = (w: number) => SPARK_PAD + (1 - (w - wMin) / wSpan) * (SPARK_H - 2 * SPARK_PAD)

  const d =
    d3Line<WeightPoint>()
      .x((p) => x(p.t))
      .y((p) => y(p.weight))
      .curve(curveMonotoneX)(points) ?? ''
  const last = points[points.length - 1]!

  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Path
        d={d}
        stroke={colors.magenta}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={x(last.t)} cy={y(last.weight)} r={3.2} fill={colors.magenta} />
    </Svg>
  )
}

/* ─── Slide 3 — water intake ───────────────────────────────────────── */

const WATER_TARGET = 8
const GLASS_SIZE = 34
// A tumbler — water is shown as a glass, matching the "vasos" copy,
// so it never reads as a magenta blood drop / cycle tracker.
const GLASS = 'M6 3.6 H18 L16.2 20.8 H7.8 Z'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

/* One glass — a magenta outline that fills with rising water on a
 * spring when tapped. The water is a rect clipped to the glass
 * shape; its top edge eases up from the base (empty) to the rim
 * (full). A soft magenta halo fades in as it fills. */
function Glass({
  index,
  filled,
  onPress,
}: {
  index: number
  filled: boolean
  onPress: () => void
}) {
  const fill = useSharedValue(filled ? 1 : 0)
  useEffect(() => {
    fill.value = withSpring(filled ? 1 : 0, { damping: 15, stiffness: 130 })
  }, [filled, fill])

  // Water level — a rect clipped to the glass. y eases from the
  // base (24, empty) up to the rim (0, full).
  const waterProps = useAnimatedProps(() => {
    const h = 24 * fill.value
    return { y: 24 - h, height: h }
  })
  const glowStyle = useAnimatedStyle(() => ({ shadowOpacity: fill.value * 0.55 }))

  const clipId = `glass-${index}`
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <Animated.View style={[styles.glassGlow, glowStyle]}>
        <Svg width={GLASS_SIZE} height={GLASS_SIZE} viewBox="0 0 24 24">
          <Defs>
            <ClipPath id={clipId}>
              <Path d={GLASS} />
            </ClipPath>
          </Defs>
          <AnimatedRect
            x={0}
            width={24}
            fill={colors.magenta}
            clipPath={`url(#${clipId})`}
            animatedProps={waterProps}
          />
          <Path
            d={GLASS}
            fill="none"
            stroke={colors.magenta}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </Pressable>
  )
}

function WaterSlide({ date }: { date: string }) {
  const { data: glasses = 0 } = useWaterToday(date)
  const setWater = useSetWater(date)
  const tap = (idx: number) => {
    Haptics.selectionAsync().catch(() => {})
    // Tap a droplet to fill up to it; tap the current top droplet
    // again to step one back down.
    setWater.mutate(glasses === idx + 1 ? idx : idx + 1)
  }
  return (
    <View style={styles.slide}>
      <View style={styles.card}>
        <View style={styles.waterDroplets}>
          {Array.from({ length: WATER_TARGET }).map((_, i) => (
            <Glass key={i} index={i} filled={i < glasses} onPress={() => tap(i)} />
          ))}
        </View>
        <Text style={styles.waterCount}>
          <Text style={styles.waterCountStrong}>{glasses}</Text> de {WATER_TARGET} vasos hoy
        </Text>
      </View>
    </View>
  )
}

/* ─── Pagination dots ──────────────────────────────────────────────── */

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} on={i === active} />
      ))}
    </View>
  )
}

function Dot({ on }: { on: boolean }) {
  const p = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 260 })
  }, [on, p])
  const style = useAnimatedStyle(() => ({
    width: 6 + p.value * 12,
    opacity: 0.32 + p.value * 0.68,
  }))
  return <Animated.View style={[styles.dot, style]} />
}

const styles = StyleSheet.create({
  header: {
    marginTop: 22,
    marginBottom: 12,
  },
  measurePlaceholder: {
    height: 150,
  },
  slide: {
    minHeight: 150,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 14,
  },
  // Weight card — same chrome as the macro RingCards so the slides
  // read as one family.
  card: {
    flex: 1,
    backgroundColor: 'rgba(244,236,222,0.035)',
    borderColor: colors.bruma,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  sparkPlaceholder: {
    width: SPARK_W,
    height: SPARK_H,
  },
  numberStack: {
    flex: 1,
    minWidth: 0,
  },
  weightTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  weightValue: {
    fontFamily: typography.displayHeavy,
    fontSize: 44,
    color: colors.leche,
    letterSpacing: -1.8,
    lineHeight: 46,
  },
  weightUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.niebla,
  },
  // Total change — the headline of progress.
  totalLine: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.bone,
  },
  deltaGood: {
    color: colors.magenta,
  },
  // Weekly pace — quieter, secondary.
  weeklyLine: {
    marginTop: 3,
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.niebla,
  },
  emptyCard: {
    backgroundColor: 'rgba(244,236,222,0.035)',
    borderColor: colors.bruma,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.niebla,
    textAlign: 'center',
  },
  waterDroplets: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Soft magenta aura — shadowOpacity is animated, so it only glows
  // once a glass has water in it.
  glassGlow: {
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 7,
  },
  waterCount: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.niebla,
  },
  waterCountStrong: {
    fontFamily: typography.displaySemi,
    fontStyle: 'normal',
    fontSize: 17,
    color: colors.leche,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
})
