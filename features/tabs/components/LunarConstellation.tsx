import { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { magnitudeToRadius } from '../zodiac/astronomy/project'
import { ZODIAC } from '../zodiac/data'
import type { ZodiacDef, ZodiacSign } from '../zodiac/types'

// Bright stars (mag ≤ 2) earn the cross sparkle. With real Hipparcos
// data that means Aldebaran, Regulus, Antares, Spica, Pollux, Castor,
// Shaula, Elnath, Kaus Australis, Sargas, Alhena, Hamal — about a
// dozen per zodiac coverage, never more than 1-3 per sign.
const SPARKLE_MAG_THRESHOLD = 2

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

const W = 290
const H = 290
const PAD = 30
const TARGET_DAYS = 28
const AMBIENT_STAR_COUNT = 64
const AMBIENT_BUCKET_COUNT = 8

type Resolved = {
  x: number
  y: number
  mag: number
}

type SequenceEl = { type: 'star' | 'line'; idx: number }

type Props = {
  /** 28-day boolean array; index i is the i-th cell. */
  trained: readonly boolean[]
  todayIdx: number
  sign?: ZodiacSign
}

export function LunarConstellation({ trained, todayIdx, sign = 'acuario' }: Props) {
  const zodiac = ZODIAC[sign]
  const cx = W / 2
  const cy = H / 2

  const { trainedCount, elementsLit, sequence, isComplete, label } = useMemo(
    () => deriveProgress(trained, todayIdx, zodiac),
    [trained, todayIdx, zodiac],
  )

  const stars: Resolved[] = useMemo(
    () =>
      zodiac.stars.map((s) => ({
        x: PAD + s.x * (W - 2 * PAD),
        y: PAD + s.y * (H - 2 * PAD),
        mag: s.mag,
      })),
    [zodiac],
  )

  const litKeys = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < Math.min(elementsLit, sequence.length); i++) {
      const el = sequence[i]
      if (el) set.add(`${el.type}-${el.idx}`)
    }
    return set
  }, [elementsLit, sequence])
  const nextEl: SequenceEl | null = sequence[elementsLit] ?? null

  // Shared time pulse driving every animation. Single 8s loop on UI
  // thread; per-element worklets read from it with a phase offset so
  // animations look independent without spawning N timers.
  const t = useSharedValue(0)
  // Slow rotation for the sparkle decoration on brightest stars.
  const sparkleT = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    sparkleT.value = withRepeat(
      withTiming(1, { duration: 24000, easing: Easing.linear }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(sparkleT)
    }
  }, [t, sparkleT])

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
        <SvgGradients />
        <AmbientField t={t} />
        <CenterBloom cx={cx} cy={cy} t={t} />
        <BaseLayer zodiac={zodiac} stars={stars} />
        <LitLines zodiac={zodiac} stars={stars} litKeys={litKeys} nextEl={nextEl} />
        <CenterText cx={cx} cy={cy} trainedCount={trainedCount} label={label} />
        <StarsLayer stars={stars} litKeys={litKeys} nextEl={nextEl} t={t} sparkleT={sparkleT} />
        {isComplete ? <CompletionRings cx={cx} cy={cy} t={t} /> : null}
      </Svg>

      <View style={styles.zodiacCap}>
        <Text style={styles.zodiacGlyph}>{zodiac.glyph}</Text>
        <Text style={styles.zodiacLabel}>{zodiac.label}</Text>
        {isComplete ? <Text style={styles.zodiacOverflow}> · COMPLETO</Text> : null}
      </View>
    </View>
  )
}

function deriveProgress(
  trained: readonly boolean[],
  todayIdx: number,
  zodiac: ZodiacDef,
): {
  trainedCount: number
  elementsLit: number
  sequence: SequenceEl[]
  isComplete: boolean
  label: string
} {
  const count = trained.slice(0, todayIdx + 1).filter(Boolean).length
  const nStars = zodiac.stars.length
  const nLines = zodiac.lines.length
  const pct = Math.min(1, count / TARGET_DAYS)
  const lit = Math.round(pct * (nStars + nLines))
  const complete = count >= TARGET_DAYS
  const pctRound = Math.round(pct * 100)

  // Interleave stars + lines so each line is preceded by both its
  // endpoint stars. Leftover stars trail at the end.
  const seq: SequenceEl[] = []
  const seen = new Set<number>()
  if (nStars > 0) {
    seq.push({ type: 'star', idx: 0 })
    seen.add(0)
  }
  zodiac.lines.forEach((ln, lineIdx) => {
    const [a, b] = ln
    if (!seen.has(a)) {
      seq.push({ type: 'star', idx: a })
      seen.add(a)
    }
    if (!seen.has(b)) {
      seq.push({ type: 'star', idx: b })
      seen.add(b)
    }
    seq.push({ type: 'line', idx: lineIdx })
  })
  for (let i = 0; i < nStars; i++) {
    if (!seen.has(i)) seq.push({ type: 'star', idx: i })
  }

  const lowerLabel = zodiac.label.toLowerCase()
  const titleLabel = zodiac.label.charAt(0) + zodiac.label.slice(1).toLowerCase()
  const label = complete
    ? `${titleLabel} completo`
    : count === 0
      ? `tu ${lowerLabel} te espera`
      : pct < 0.5
        ? `${pctRound}% iluminado`
        : pct < 1
          ? `${pctRound}% · casi`
          : 'completo'

  return {
    trainedCount: count,
    elementsLit: lit,
    sequence: seq,
    isComplete: complete,
    label,
  }
}

function SvgGradients() {
  return (
    <Defs>
      <RadialGradient id="starLit" cx="35%" cy="35%">
        <Stop offset="0%" stopColor="#FFF6E5" />
        <Stop offset="55%" stopColor="#F4ECDE" />
        <Stop offset="100%" stopColor="#C9B8A5" />
      </RadialGradient>
      <RadialGradient id="starNext" cx="35%" cy="35%">
        <Stop offset="0%" stopColor="#FFB8D4" />
        <Stop offset="55%" stopColor="#E91E63" />
        <Stop offset="100%" stopColor="#7A1737" />
      </RadialGradient>
      <RadialGradient id="centerBloom" cx="50%" cy="50%">
        <Stop offset="0%" stopColor="rgba(233,30,99,0.22)" />
        <Stop offset="55%" stopColor="rgba(233,30,99,0.05)" />
        <Stop offset="100%" stopColor="rgba(233,30,99,0)" />
      </RadialGradient>
    </Defs>
  )
}

/* ─ Ambient star field ──────────────────────────────────────────── */

type AmbientStar = { x: number; y: number; r: number; baseOp: number }

// Deterministic field that avoids the centre block where the day
// counter lives. The seed math is intentionally noisy — `Math.sin` of
// large integers gives us a stable pseudo-random sequence without
// pulling in a PRNG. Stars are bucketed by index so the twinkle stays
// cheap (one worklet per bucket, not per star).
function buildAmbientField(): AmbientStar[][] {
  const buckets: AmbientStar[][] = Array.from({ length: AMBIENT_BUCKET_COUNT }, () => [])
  for (let i = 0; i < AMBIENT_STAR_COUNT; i++) {
    const a = Math.sin(i * 47.1 + 3.7)
    const b = Math.sin(i * 91.3 + 1.1)
    const x = ((((a * 9301 + 49297) % 1) + 1) % 1) * W
    const y = ((((b * 8101 + 26183) % 1) + 1) % 1) * H
    const dx = x - W / 2
    const dy = y - H / 2
    if (dx * dx + dy * dy < 3200) continue
    const baseOp = 0.04 + Math.abs(a * b) * 0.1
    const r = 0.4 + Math.abs(a) * 0.7
    const bucket = i % AMBIENT_BUCKET_COUNT
    buckets[bucket]!.push({ x, y, r, baseOp })
  }
  return buckets
}

function AmbientField({ t }: { t: SharedValue<number> }) {
  const buckets = useMemo(() => buildAmbientField(), [])
  return (
    <G>
      {buckets.map((stars, bucketIdx) => (
        <AmbientBucket key={bucketIdx} stars={stars} bucketIdx={bucketIdx} t={t} />
      ))}
    </G>
  )
}

function AmbientBucket({
  stars,
  bucketIdx,
  t,
}: {
  stars: AmbientStar[]
  bucketIdx: number
  t: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const phase = bucketIdx / AMBIENT_BUCKET_COUNT
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return { opacity: 0.35 + 0.65 * wave }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.baseOp * 4} />
      ))}
    </AnimatedG>
  )
}

/* ─ Centre bloom (faint magenta vignette) ───────────────────────── */

function CenterBloom({ cx, cy, t }: { cx: number; cy: number; t: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { opacity: 0.7 + 0.3 * wave }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={78} fill="url(#centerBloom)" animatedProps={animatedProps} />
  )
}

/* ─ Base placeholder layer (always visible silhouette) ──────────── */

function BaseLayer({ zodiac, stars }: { zodiac: ZodiacDef; stars: Resolved[] }) {
  return (
    <G>
      {zodiac.lines.map(([a, b], idx) => {
        const A = stars[a]
        const B = stars[b]
        if (!A || !B) return null
        return (
          <Line
            key={`bl-${idx}`}
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
            stroke="rgba(244,236,222,0.28)"
            strokeWidth={0.8}
            strokeLinecap="round"
          />
        )
      })}
      {stars.map((s, i) => (
        <Circle
          key={`bs-${i}`}
          cx={s.x}
          cy={s.y}
          r={magnitudeToRadius(s.mag) * 0.65}
          fill="rgba(244,236,222,0.55)"
        />
      ))}
    </G>
  )
}

/* ─ Lit & next lines ────────────────────────────────────────────── */

function LitLines({
  zodiac,
  stars,
  litKeys,
  nextEl,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
}) {
  return (
    <>
      {zodiac.lines.map(([a, b], idx) => {
        const A = stars[a]
        const B = stars[b]
        if (!A || !B) return null
        const isLit = litKeys.has(`line-${idx}`)
        const isNext = nextEl?.type === 'line' && nextEl.idx === idx
        if (!isLit && !isNext) return null
        return (
          <Line
            key={`l-${idx}`}
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
            stroke={isLit ? colors.magenta : 'rgba(233,30,99,0.35)'}
            strokeWidth={isLit ? 1.2 : 0.8}
            strokeLinecap="round"
            strokeDasharray={isLit ? undefined : '2 3'}
          />
        )
      })}
    </>
  )
}

/* ─ Centre counter texts ────────────────────────────────────────── */

function CenterText({
  cx,
  cy,
  trainedCount,
  label,
}: {
  cx: number
  cy: number
  trainedCount: number
  label: string
}) {
  return (
    <>
      <SvgText
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontFamily={typography.displayHeavy}
        fontSize={64}
        fill={colors.magenta}
        letterSpacing={-3.5}
      >
        {trainedCount}
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={10}
        fill={colors.niebla}
        letterSpacing={2.4}
      >
        DE 28 DÍAS
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 44}
        textAnchor="middle"
        fontFamily={typography.serif}
        fontStyle="italic"
        fontSize={13}
        fill={colors.bone}
      >
        {label}
      </SvgText>
    </>
  )
}

/* ─ Stars layer (dispatches lit / next variants) ────────────────── */

function StarsLayer({
  stars,
  litKeys,
  nextEl,
  t,
  sparkleT,
}: {
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  t: SharedValue<number>
  sparkleT: SharedValue<number>
}) {
  return (
    <>
      {stars.map((s, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (isNext) return <NextStar key={`s-${i}`} s={s} t={t} />
        if (isLit) return <LitStar key={`s-${i}`} s={s} i={i} t={t} sparkleT={sparkleT} />
        return null
      })}
    </>
  )
}

function NextStar({ s, t }: { s: Resolved; t: SharedValue<number> }) {
  const r = magnitudeToRadius(s.mag) + 1.5

  // Outer halo pulse — 2.4s yoyo, fades from 0 to ~22 px radius.
  const haloProps = useAnimatedProps(() => {
    'worklet'
    // 2.4 s ÷ 8 s base loop ≈ 0.3 — derive a faster sub-pulse off t.
    const pulse = (t.value * (8 / 2.4)) % 1
    return {
      r: r + 6 + pulse * 14,
      opacity: 0.55 * (1 - pulse),
    }
  })

  const midProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { opacity: 0.18 + 0.18 * wave }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={r + 14}
        fill="rgba(233,30,99,0.10)"
        animatedProps={haloProps}
      />
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={r + 6}
        fill="rgba(233,30,99,0.22)"
        animatedProps={midProps}
      />
      <Circle cx={s.x} cy={s.y} r={r} fill="url(#starNext)" />
      <Line
        x1={s.x - r * 2.6}
        y1={s.y}
        x2={s.x + r * 2.6}
        y2={s.y}
        stroke="rgba(255,184,212,0.55)"
        strokeWidth={0.6}
      />
      <Line
        x1={s.x}
        y1={s.y - r * 2.6}
        x2={s.x}
        y2={s.y + r * 2.6}
        stroke="rgba(255,184,212,0.55)"
        strokeWidth={0.6}
      />
    </G>
  )
}

function LitStar({
  s,
  i,
  t,
  sparkleT,
}: {
  s: Resolved
  i: number
  t: SharedValue<number>
  sparkleT: SharedValue<number>
}) {
  const r = magnitudeToRadius(s.mag) + 0.5

  // Per-star phase offset so adjacent stars breathe out of sync.
  const phase = (i * 0.137) % 1

  const coreProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return { r: r * (1 + wave * 0.12), opacity: 0.85 + 0.15 * wave }
  })

  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return { opacity: 0.05 + 0.2 * wave }
  })

  const sparkleProps = useAnimatedProps(() => {
    'worklet'
    const deg = sparkleT.value * 360
    return { transform: [{ rotate: `${deg}deg` }] }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={r + 5}
        fill="rgba(244,236,222,0.05)"
        animatedProps={haloProps}
      />
      <AnimatedCircle cx={s.x} cy={s.y} r={r} fill="url(#starLit)" animatedProps={coreProps} />
      {s.mag <= SPARKLE_MAG_THRESHOLD ? (
        <AnimatedG animatedProps={sparkleProps} origin={`${s.x}, ${s.y}`}>
          <Line
            x1={s.x - r * 3}
            y1={s.y}
            x2={s.x + r * 3}
            y2={s.y}
            stroke="rgba(244,236,222,0.50)"
            strokeWidth={0.5}
          />
          <Line
            x1={s.x}
            y1={s.y - r * 3}
            x2={s.x}
            y2={s.y + r * 3}
            stroke="rgba(244,236,222,0.50)"
            strokeWidth={0.5}
          />
        </AnimatedG>
      ) : null}
    </G>
  )
}

/* ─ Completion rings ────────────────────────────────────────────── */

function CompletionRings({ cx, cy, t }: { cx: number; cy: number; t: SharedValue<number> }) {
  const innerProps = useAnimatedProps(() => {
    'worklet'
    // 5s loop derived from the 8s base.
    const p = (t.value * (8 / 5)) % 1
    return { r: 110 + p * 20, opacity: 0.35 * (1 - p) }
  })
  const outerProps = useAnimatedProps(() => {
    'worklet'
    const p = (t.value * (8 / 5) + 0.32) % 1
    return { r: 130 + p * 20, opacity: 0.2 * (1 - p) }
  })
  return (
    <G>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={110}
        fill="none"
        stroke="rgba(233,30,99,0.35)"
        strokeWidth={0.5}
        animatedProps={innerProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={130}
        fill="none"
        stroke="rgba(233,30,99,0.20)"
        strokeWidth={0.5}
        animatedProps={outerProps}
      />
    </G>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 4,
  },
  svg: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 1,
  },
  zodiacCap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
    marginBottom: 14,
  },
  zodiacGlyph: {
    fontFamily: typography.uiBold,
    fontSize: 16,
    color: colors.magenta,
  },
  zodiacLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    color: colors.leche,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  zodiacOverflow: {
    fontFamily: typography.displayHeavy,
    fontSize: 13,
    color: colors.magenta,
    letterSpacing: -0.5,
  },
})
