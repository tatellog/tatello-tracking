import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg'

import { colors, typography } from '@/theme'

type ZodiacSign = 'acuario'

type ZodiacStar = {
  /** Relative coords 0..1 inside the SVG box. */
  x: number
  y: number
  /** 1 = brightest (largest dot), 5 = faintest. */
  mag: number
}

type ZodiacDef = {
  label: string
  glyph: string
  stars: readonly ZodiacStar[]
  lines: readonly (readonly [number, number])[]
}

// Hand-shaped to be recognisable while leaving the centre clear for
// the day-counter text. Roadmap: pick by `profile.date_of_birth`.
const ZODIAC: Record<ZodiacSign, ZodiacDef> = {
  acuario: {
    label: 'ACUARIO',
    glyph: '♒',
    stars: [
      { x: 0.18, y: 0.14, mag: 2 },
      { x: 0.44, y: 0.18, mag: 2 },
      { x: 0.66, y: 0.3, mag: 3 },
      { x: 0.84, y: 0.26, mag: 4 },
      { x: 0.94, y: 0.46, mag: 4 },
      { x: 0.55, y: 0.42, mag: 3 },
      { x: 0.6, y: 0.64, mag: 4 },
      { x: 0.42, y: 0.74, mag: 3 },
      { x: 0.24, y: 0.88, mag: 3 },
      { x: 0.74, y: 0.84, mag: 4 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [1, 5],
      [2, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [6, 9],
    ],
  },
}

const W = 290
const H = 290
const PAD = 30
const TARGET_DAYS = 28

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

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
        <SvgGradients />
        <Circle cx={cx} cy={cy} r={78} fill="url(#centerBloom)" />
        <BaseLayer zodiac={zodiac} stars={stars} />
        <LitLines zodiac={zodiac} stars={stars} litKeys={litKeys} nextEl={nextEl} />
        <CenterText cx={cx} cy={cy} trainedCount={trainedCount} label={label} />
        <StarsLayer stars={stars} litKeys={litKeys} nextEl={nextEl} />
        {isComplete ? <CompletionRings cx={cx} cy={cy} /> : null}
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

  // Sequence: interleave stars + lines so each line is preceded by both
  // its endpoint stars. Leftover stars (none in current data) trail.
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

  const label = complete
    ? `${zodiac.label.charAt(0)}${zodiac.label.slice(1).toLowerCase()} completo`
    : count === 0
      ? `tu ${zodiac.label.toLowerCase()} te espera`
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
          r={(6 - s.mag) * 0.85}
          fill="rgba(244,236,222,0.55)"
        />
      ))}
    </G>
  )
}

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

function StarsLayer({
  stars,
  litKeys,
  nextEl,
}: {
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
}) {
  return (
    <>
      {stars.map((s, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (isNext) return <NextStar key={`s-${i}`} s={s} />
        if (isLit) return <LitStar key={`s-${i}`} s={s} />
        return null
      })}
    </>
  )
}

function NextStar({ s }: { s: Resolved }) {
  const magR = 6 - s.mag
  const r = magR + 2
  return (
    <G>
      <Circle cx={s.x} cy={s.y} r={r + 14} fill="rgba(233,30,99,0.10)" />
      <Circle cx={s.x} cy={s.y} r={r + 6} fill="rgba(233,30,99,0.22)" />
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

function LitStar({ s }: { s: Resolved }) {
  const magR = 6 - s.mag
  const r = magR + 1
  return (
    <G>
      <Circle cx={s.x} cy={s.y} r={r + 5} fill="rgba(244,236,222,0.05)" />
      <Circle cx={s.x} cy={s.y} r={r} fill="url(#starLit)" />
      {s.mag <= 2 ? (
        <G>
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
        </G>
      ) : null}
    </G>
  )
}

function CompletionRings({ cx, cy }: { cx: number; cy: number }) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={110} fill="none" stroke="rgba(233,30,99,0.35)" strokeWidth={0.5} />
      <Circle cx={cx} cy={cy} r={130} fill="none" stroke="rgba(233,30,99,0.20)" strokeWidth={0.5} />
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
    // ♒ renders as plain text in RN (no emoji color fallback); paint
    // it magenta so the cap still reads as accented.
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
