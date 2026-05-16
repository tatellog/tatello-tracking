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
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const PANEL_H = 248
// 4-point star, viewBox 24×24, centred (12,12) — the app's shared
// star glyph, also used by the Hoy-tab constellation and WeekStrip.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
// Meal stars + ambient dust live in the top band; the protein
// readout, bars and calorie line own the lower band — never clash.
const STAR_BAND_TOP = 16
const STAR_BAND_BOTTOM = 76
const DUST_COUNT = 26
const FILL_EASING = Easing.bezier(0.2, 0.7, 0.2, 1)

type MealLike = { id: string; protein_g: number | string }

type Props = {
  meals: readonly MealLike[]
  proteinValue: number
  proteinTarget: number
  caloriesValue: number
  caloriesTarget: number
}

/* FNV-1a — a tiny deterministic string hash. Same meal id always maps
 * to the same spot in the sky, so stars don't jump between renders. */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/* Renders one 4-point star at (cx, cy) with outer radius r by
 * translating + scaling the shared 24×24 glyph. */
function starTransform(cx: number, cy: number, r: number) {
  const s = (r * 2) / 24
  return `translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`
}

/*
 * "Tu cielo" — the whole day's nourishment in one panel.
 *
 * Protein is the hero: each logged meal places a star, scattered
 * deterministically by its id and sized by its protein contribution,
 * so a protein-heavy meal is literally a brighter star and the day
 * reads as a small constellation. Behind them a magenta bloom grows
 * with progress — at 0 % the sky is near-black, at 100 % fully lit.
 *
 * Calories ride along as a quiet sub-line below a hairline: a budget,
 * not a goal, so it carries a neutral (cream) bar — distinct from the
 * protein goal's magenta — and turns red only when overspent.
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
    progCal.value = withDelay(320, withTiming(calPct, { duration: 1100, easing: FILL_EASING }))
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
      x: 8 + rnd() * (w - 16),
      y: STAR_BAND_TOP + rnd() * (STAR_BAND_BOTTOM - STAR_BAND_TOP),
      r: 0.6 + rnd() * 1.1,
      o: 0.1 + rnd() * 0.22,
    }))
  }, [w])

  // One star per meal — position from the id hash, radius from the
  // meal's protein (clamped 3 → 8.5 px).
  const mealStars = useMemo(() => {
    if (w == null) return []
    const padX = 18
    return meals.map((m) => {
      const h = hashStr(m.id)
      const hx = (h & 0xffff) / 0xffff
      const hy = ((h >>> 16) & 0xffff) / 0xffff
      const p = Number(m.protein_g) || 0
      return {
        id: m.id,
        x: padX + hx * (w - padX * 2),
        y: STAR_BAND_TOP + 6 + hy * (STAR_BAND_BOTTOM - STAR_BAND_TOP - 12),
        r: 3 + Math.min(1, p / 35) * 5.5,
      }
    })
  }, [meals, w])

  const bloomProps = useAnimatedProps(() => ({ opacity: prog.value }))
  const fillStyle = useAnimatedStyle(() => ({ width: `${prog.value * 100}%` }))
  const calFillStyle = useAnimatedStyle(() => ({ width: `${progCal.value * 100}%` }))

  const bloomCx = w != null ? w * 0.3 : 0

  return (
    <View style={[styles.panel, complete && styles.panelComplete]} onLayout={handleLayout}>
      {w != null ? (
        <Svg style={StyleSheet.absoluteFill} width={w} height={PANEL_H}>
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.5} />
              <Stop offset="55%" stopColor={colors.magenta} stopOpacity={0.16} />
              <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* Progress bloom — fades up from black sky to lit sky. */}
          <AnimatedCircle
            cx={bloomCx}
            cy={138}
            r={112}
            fill="url(#bloom)"
            animatedProps={bloomProps}
          />

          {/* Ambient dust — the night sky is never fully empty. */}
          {dust.map((d, i) => (
            <Circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={colors.leche} opacity={d.o} />
          ))}

          {/* One star per meal, sized by its protein. */}
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

        <View style={styles.divider} />

        <View style={styles.calRow}>
          <Text style={styles.calLabel}>Presupuesto</Text>
          <Text style={[styles.calValue, overBudget && styles.calOver]}>
            {Math.round(caloriesValue)} / {caloriesTarget} kcal
          </Text>
        </View>
        <View style={styles.calTrack}>
          <Animated.View style={[styles.calFill, overBudget && styles.calFillOver, calFillStyle]} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Deep page-black, not a lifted card surface — the sky should read
  // as a framed window into the night, not a panel sitting on top.
  panel: {
    height: PANEL_H,
    borderRadius: 18,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    marginBottom: 14,
  },
  panelComplete: {
    borderColor: colors.magentaGlow,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 15,
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
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
    marginTop: 10,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.magenta,
  },
  footer: {
    marginTop: 7,
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.bone,
  },
  // Hairline that separates the protein hero from the calorie budget.
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginTop: 14,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 12,
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
