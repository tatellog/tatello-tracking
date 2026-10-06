import { useEffect, useMemo } from 'react'
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'

import { buildFigureSequence } from '@/features/tabs/components/constellation/data/derive-progress'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors } from '@/theme'

/*
 * La constelación del mes, sin revelar el arte del signo (dueña 6 oct 2026:
 * "la idea no es revelar el acuario"). Las piezas de la figura (estrellas y
 * líneas, en su orden de encendido) que ya llevas brillan en oro; las que
 * faltan quedan tenues. Al abrir, se encienden una por una hasta tu cuenta
 * y luego las encendidas titilan. Reduce-motion: todo quieto, ya encendido.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const GOLD = colors.oroSoft
const DIM = 'rgba(244, 236, 222, 0.16)'
const STEP_MS = 140

export function MonthConstellation({
  sign,
  lit,
  size = 220,
}: {
  sign: ZodiacSign
  /** Piezas encendidas este mes (estrellas + líneas, en orden). */
  lit: number
  size?: number
}) {
  const zodiac = ZODIAC[sign]
  const seq = useMemo(() => buildFigureSequence(zodiac), [zodiac])
  // Posición en la secuencia de cada estrella y de cada línea.
  const starPos = useMemo(() => {
    const m = new Map<number, number>()
    seq.forEach((el, i) => el.type === 'star' && m.set(el.idx, i))
    return m
  }, [seq])
  const linePos = useMemo(() => {
    const m = new Map<number, number>()
    seq.forEach((el, i) => el.type === 'line' && m.set(el.idx, i))
    return m
  }, [seq])

  const reduce = useReducedMotion() ?? false
  // Cuántas piezas van encendidas (animado 0 → lit al abrir).
  const progress = useSharedValue(reduce ? lit : 0)
  const twinkle = useSharedValue(0)
  useEffect(() => {
    if (reduce) {
      progress.value = lit
      return
    }
    progress.value = 0
    progress.value = withDelay(
      250,
      withTiming(lit, { duration: Math.max(1, lit) * STEP_MS, easing: Easing.linear }),
    )
    twinkle.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1,
    )
  }, [lit, reduce, progress, twinkle])

  const pad = size * 0.1
  const px = (v: number) => pad + v * (size - pad * 2)

  return (
    <Svg width={size} height={size}>
      {zodiac.lines.map(([a, b], i) => {
        const sa = zodiac.stars[a]
        const sb = zodiac.stars[b]
        if (!sa || !sb) return null
        return (
          <FigureLine
            key={`l${i}`}
            x1={px(sa.x)}
            y1={px(sa.y)}
            x2={px(sb.x)}
            y2={px(sb.y)}
            pos={linePos.get(i) ?? 999}
            progress={progress}
          />
        )
      })}
      {zodiac.stars.map((st, i) => (
        <FigureStar
          key={`s${i}`}
          cx={px(st.x)}
          cy={px(st.y)}
          r={Math.max(2, 5.2 - st.mag * 0.7)}
          pos={starPos.get(i) ?? 999}
          phase={i * 0.9}
          progress={progress}
          twinkle={twinkle}
        />
      ))}
    </Svg>
  )
}

function FigureLine({
  x1,
  y1,
  x2,
  y2,
  pos,
  progress,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  pos: number
  progress: SharedValue<number>
}) {
  const props = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, progress.value - pos))
    return { strokeOpacity: 0.18 + on * 0.62 }
  })
  return (
    <>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIM} strokeWidth={1} />
      <AnimatedLine
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={GOLD}
        strokeWidth={1.4}
        animatedProps={props}
      />
    </>
  )
}

function FigureStar({
  cx,
  cy,
  r,
  pos,
  phase,
  progress,
  twinkle,
}: {
  cx: number
  cy: number
  r: number
  pos: number
  phase: number
  progress: SharedValue<number>
  twinkle: SharedValue<number>
}) {
  const glow = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, progress.value - pos))
    const tw = 0.75 + 0.25 * Math.sin(twinkle.value * Math.PI * 2 + phase)
    return { opacity: on * 0.35 * tw, r: r * (2.6 + on * 0.6) }
  })
  const core = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, progress.value - pos))
    return { opacity: on, r: r * (0.6 + on * 0.4) }
  })
  return (
    <>
      <Circle cx={cx} cy={cy} r={r * 0.7} fill={DIM} />
      <AnimatedCircle cx={cx} cy={cy} fill={GOLD} animatedProps={glow} />
      <AnimatedCircle cx={cx} cy={cy} fill={colors.oroLeche} animatedProps={core} />
    </>
  )
}
