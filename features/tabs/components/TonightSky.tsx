import { useEffect, useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const PANEL_H = 208
// 4-point star, viewBox 24×24, centred (12,12) — the app's shared
// star glyph, also used by the Hoy-tab constellation and WeekStrip.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
const DUST_COUNT = 22
const FILL_EASING = Easing.bezier(0.2, 0.7, 0.2, 1)
// The meal-star arc lives in the panel's upper band; the readout owns
// the lower band. ARC_BASE_Y is the arc's low ends, ARC_AMP its rise.
const ARC_BASE_Y = 84
const ARC_AMP = 24
const PAD_X = 28
// Constellation lines never touch their stars — each segment stops
// this far short of the star glyph, leaving the star to float.
const THREAD_GAP = 4

type MealLike = { id: string; protein_g: number | string }

type Props = {
  meals: readonly MealLike[]
  proteinValue: number
  proteinTarget: number
  caloriesValue: number
  caloriesTarget: number
}

/* Renders one 4-point star at (cx, cy) with outer radius r by
 * translating + scaling the shared 24×24 glyph. */
function starTransform(cx: number, cy: number, r: number) {
  const s = (r * 2) / 24
  // RN-style transform array — react-native-svg accepts a string here
  // too, but a string crashes on Android's New Architecture (the
  // native side expects a ReadableArray).
  return [{ translateX: cx - 12 * s }, { translateY: cy - 12 * s }, { scale: s }]
}

/*
 * "Tu cielo" — the day's protein, made the hero.
 *
 * Depth comes from three stacked layers, back to front: a near-black
 * sky; a magenta bloom that fades up with progress, so the sky lights
 * as you near your goal; and the meals themselves — one star each,
 * placed in chronological order along a gentle arc and strung on a
 * faint thread, so the day reads as a deliberate constellation, not
 * a scatter. The big readout sits in the bloom's glow.
 *
 * Calories ride below the panel as a quiet budget line — neutral
 * cream, never competing with the protein goal's magenta, red only
 * when overspent.
 */
export function TonightSky({
  meals,
  proteinValue,
  proteinTarget,
  caloriesValue,
  caloriesTarget,
}: Props) {
  const [w, setW] = useState<number | null>(null)

  const pct = proteinTarget > 0 ? Math.min(1, Math.max(0, proteinValue / proteinTarget)) : 0
  const complete = pct >= 1
  const remaining = Math.max(0, Math.round(proteinTarget - proteinValue))

  const calPct = caloriesTarget > 0 ? Math.min(1, Math.max(0, caloriesValue / caloriesTarget)) : 0
  const overBudget = caloriesValue > caloriesTarget

  // 0 → pct, eased in once on mount. Protein leads, calories follows.
  const prog = useSharedValue(0)
  const progCal = useSharedValue(0)
  useEffect(() => {
    prog.value = withDelay(160, withTiming(pct, { duration: 1100, easing: FILL_EASING }))
    progCal.value = withDelay(360, withTiming(calPct, { duration: 1100, easing: FILL_EASING }))
  }, [prog, progCal, pct, calPct])

  const handleLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)

  // Ambient dust — deterministic per index, so it never reshuffles.
  const dust = useMemo(() => {
    if (w == null) return []
    let seed = 0x9e3779b9
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    return Array.from({ length: DUST_COUNT }, () => ({
      x: 10 + rnd() * (w - 20),
      y: 26 + rnd() * 74,
      r: 0.6 + rnd() * 1.1,
      o: 0.1 + rnd() * 0.22,
    }))
  }, [w])

  // One star per meal — placed in order along a gentle arc, sized by
  // the meal's protein contribution (clamped 2.6 → 7 px).
  const mealStars = useMemo(() => {
    if (w == null || meals.length === 0) return []
    const n = meals.length
    const span = w - PAD_X * 2
    return meals.map((m, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const p = Number(m.protein_g) || 0
      return {
        id: m.id,
        x: PAD_X + t * span,
        y: ARC_BASE_Y - ARC_AMP * Math.sin(Math.PI * t),
        r: 2.6 + Math.min(1, p / 35) * 4.4,
      }
    })
  }, [meals, w])

  // Constellation edges — one trimmed segment between consecutive
  // stars. Each end is pulled back past the star's radius + a gap, so
  // the line connects stars without running into the glyphs. A pair
  // sitting too close to leave a visible segment is simply skipped.
  const threadSegments = useMemo(() => {
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let i = 0; i < mealStars.length - 1; i++) {
      const a = mealStars[i]
      const b = mealStars[i + 1]
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const len = Math.hypot(dx, dy)
      if (len <= a.r + b.r + THREAD_GAP * 2) continue
      const ux = dx / len
      const uy = dy / len
      segs.push({
        x1: a.x + ux * (a.r + THREAD_GAP),
        y1: a.y + uy * (a.r + THREAD_GAP),
        x2: b.x - ux * (b.r + THREAD_GAP),
        y2: b.y - uy * (b.r + THREAD_GAP),
      })
    }
    return segs
  }, [mealStars])

  const bloomProps = useAnimatedProps(() => ({ opacity: 0.35 + prog.value * 0.65 }))
  const fillStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }))
  const calFillStyle = useAnimatedStyle(() => ({ width: `${progCal.value * 100}%` }))

  const bloomCx = w != null ? w * 0.32 : 0

  return (
    <View style={styles.wrap}>
      <View style={[styles.panel, complete && styles.panelComplete]} onLayout={handleLayout}>
        {w != null ? (
          <Svg style={StyleSheet.absoluteFill} width={w} height={PANEL_H}>
            <Defs>
              <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.55} />
                <Stop offset="55%" stopColor={colors.magenta} stopOpacity={0.16} />
                <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
              </RadialGradient>
            </Defs>

            {/* Progress bloom — fades up from black sky to lit sky. */}
            <AnimatedCircle
              cx={bloomCx}
              cy={150}
              r={140}
              fill="url(#bloom)"
              animatedProps={bloomProps}
            />

            {/* Ambient dust — the night sky is never fully empty. */}
            {dust.map((d, i) => (
              <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={colors.leche} opacity={d.o} />
            ))}

            {/* Constellation edges — trimmed segments that stop short
                of each star, round-capped, so the stars float free. */}
            {threadSegments.map((seg, i) => (
              <Line
                key={`t${i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke={complete ? colors.magenta : colors.leche}
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.34}
              />
            ))}

            {/* One star per meal, in order, sized by its protein. */}
            {mealStars.map((s) => (
              <Path
                key={s.id}
                d={STAR_PATH}
                transform={starTransform(s.x, s.y, s.r)}
                fill={complete ? colors.magenta : colors.leche}
              />
            ))}
          </Svg>
        ) : null}

        <View style={styles.content} pointerEvents="none">
          <Text style={styles.eyebrow}>Tu cielo</Text>
          <View style={styles.spacer} />

          <View style={styles.readout}>
            <Text style={styles.value}>{Math.round(proteinValue)}</Text>
            <Text style={styles.target}> / {proteinTarget} g</Text>
          </View>
          <Text style={styles.caption}>proteína</Text>

          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, fillStyle]} />
          </View>
          <Text style={styles.footer}>
            {complete
              ? 'Tu cielo está completo ✦'
              : `${Math.round(pct * 100)} % · faltan ${remaining} g`}
          </Text>
        </View>
      </View>

      {/* Calorie budget — a quiet line below the hero, not a co-star. */}
      <View style={styles.calRow}>
        <Text style={styles.calLabel}>Calorías</Text>
        <Text style={[styles.calValue, overBudget && styles.calOver]}>
          {Math.round(caloriesValue)} / {caloriesTarget} kcal
        </Text>
      </View>
      <View style={styles.calTrack}>
        <Animated.View style={[styles.calFill, overBudget && styles.calFillOver, calFillStyle]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 6,
  },
  // Deep page-black, not a lifted card surface — the sky reads as a
  // framed window into the night, not a panel sitting on top.
  panel: {
    height: PANEL_H,
    borderRadius: 18,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  panelComplete: {
    borderColor: colors.magentaGlow,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.magenta,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  spacer: {
    flex: 1,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 46,
    color: colors.leche,
    letterSpacing: -1.6,
    lineHeight: 46,
  },
  target: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    color: colors.bone,
  },
  caption: {
    fontFamily: typography.uiSemi,
    fontSize: 9.5,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  // A carved channel; the fill is light moving inside it.
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(244,236,222,0.08)',
    overflow: 'hidden',
    marginTop: 11,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  footer: {
    marginTop: 8,
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.bone,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
  },
  calLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  calValue: {
    fontFamily: typography.uiSemi,
    fontSize: 12.5,
    color: colors.bone,
  },
  calOver: {
    color: colors.feedbackError,
  },
  // Neutral cream fill — a budget consumed, not a goal reached.
  calTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
    marginTop: 7,
  },
  calFill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: colors.bone,
  },
  calFillOver: {
    backgroundColor: colors.feedbackError,
  },
})
