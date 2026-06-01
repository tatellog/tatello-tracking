import LottieView from 'lottie-react-native'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { MEAL_TYPES, type MealTypeKey, type WeeklyMealStats } from '@/features/macros/logic'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = 132
const C = SIZE / 2
const R = 52
const STROKE = 12
const GAP = 0.012 // fraction of the circle left blank between segments
const TAU = Math.PI * 2

// Meal-time palette: a day's arc from golden dawn to cool night. NO
// magenta — the section eyebrow + toggle already spend the 2-accent
// budget, and these are neutral times, not "good/bad" foods.
const SEGMENTS: Record<MealTypeKey, { color: string; label: string }> = {
  breakfast: { color: colors.oroLight, label: 'Desayuno' },
  lunch: { color: colors.oro, label: 'Almuerzo' },
  dinner: { color: colors.dimension.ciclo, label: 'Cena' },
  snack: { color: colors.bone, label: 'Snack' },
}

function pointOnRing(angle: number): { x: number; y: number } {
  return { x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) }
}

/** Stroke-arc path between two fractions (0..1) of the circle, top-origin,
 *  clockwise. */
function arcPath(f0: number, f1: number): string {
  const a0 = -Math.PI / 2 + f0 * TAU
  const a1 = -Math.PI / 2 + f1 * TAU
  const p0 = pointOnRing(a0)
  const p1 = pointOnRing(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${large} 1 ${p1.x} ${p1.y}`
}

/*
 * WeekRing — a celestial donut of the week's meals by TIME (desayuno /
 * almuerzo / cena / snack), with the total at the centre and a legend
 * beside it. Genshin-calm: a soft oro halo breathes behind the ring on
 * an 8s clock (parked under reduced motion). The segments classify by
 * WHEN you ate, never by good/bad food — manifesto-safe.
 */
export function WeekRing({ stats }: { stats: WeeklyMealStats }) {
  const reduce = useReducedMotion()
  const t = useSharedValue(0)
  useEffect(() => {
    if (reduce) {
      t.value = 0.3
      return () => cancelAnimation(t)
    }
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [t, reduce])

  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * Math.PI * 2)
    return { opacity: 0.06 + 0.06 * wave }
  })

  const total = stats.totalMeals
  // Build the visible segments (skip empty times) with cumulative fractions.
  let cursor = 0
  const segments = MEAL_TYPES.flatMap((key) => {
    const count = stats.byMealType[key]
    if (count === 0 || total === 0) return []
    const frac = count / total
    const f0 = cursor + GAP / 2
    const f1 = cursor + frac - GAP / 2
    cursor += frac
    return [{ key, count, d: arcPath(f0, Math.max(f1, f0 + 0.001)) }]
  })

  return (
    <View style={styles.row}>
      <View style={styles.ringWrap}>
        {/* Ambient Genshin glow behind the donut — drifting gold dust +
            slow glints. Decoration only (pointerEvents none), off under
            reduced motion (the SVG ring still renders). */}
        {reduce ? null : (
          <View style={styles.glow} pointerEvents="none">
            <LottieView
              source={require('../../../assets/lottie/cycle-ring-glow.json')}
              autoPlay
              loop
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
          </View>
        )}
        <Svg width={SIZE} height={SIZE}>
          {/* breathing oro halo behind the ring */}
          <AnimatedCircle cx={C} cy={C} r={R + 6} fill={colors.oro} animatedProps={haloProps} />
          {/* track */}
          <Circle
            cx={C}
            cy={C}
            r={R}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
            fill="none"
          />
          {/* segments */}
          {segments.map((s) => (
            <Path
              key={s.key}
              d={s.d}
              stroke={SEGMENTS[s.key].color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.totalNum}>{total}</Text>
          <Text style={styles.totalLabel}>comidas</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {MEAL_TYPES.map((key) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: SEGMENTS[key].color }]} />
            <Text style={styles.legendCount}>{stats.byMealType[key]}</Text>
            <Text style={styles.legendLabel}>{SEGMENTS[key].label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 16,
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    color: colors.leche,
    letterSpacing: -1,
  },
  totalLabel: {
    marginTop: -2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1,
    color: colors.niebla,
    textTransform: 'uppercase',
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 9,
  },
  legendCount: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    width: 22,
  },
  legendLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
