import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg'

/*
 * Íconos de Progreso al estilo Salud (dueña 7 oct 2026): un glifo de trazo en
 * el color de su categoría, junto al título, con un gesto corto al aparecer
 * (nunca en bucle). Reduce-motion: quietos, ya en su estado final.
 */

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Báscula: la aguja llega desde un lado y se asienta. */
export function ScaleGlyph({ size = 18, color }: { size?: number; color: string }) {
  const reduce = useReducedMotion()
  const angle = useSharedValue(reduce ? 0 : -55)
  useEffect(() => {
    if (reduce) return
    angle.value = withDelay(150, withSpring(0, { damping: 7, stiffness: 120 }))
  }, [reduce, angle])
  const needle = useAnimatedProps(() => ({ rotation: angle.value, originX: 12, originY: 13 }))
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path d="M7.5 11a4.5 4.5 0 0 1 9 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <AnimatedG animatedProps={needle}>
        <Path d="M12 13V8.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </AnimatedG>
    </Svg>
  )
}

/** Gota (ciclo): se llena de abajo hacia arriba. */
export function DropGlyph({ size = 18, color }: { size?: number; color: string }) {
  const reduce = useReducedMotion()
  const level = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) return
    level.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }))
  }, [reduce, level])
  const fill = useAnimatedProps(() => ({ y: 22 - 19 * level.value, height: 19 * level.value }))
  const drop = 'M12 3c3 4 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 9 7 12 3z'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id="drop-clip">
          <Path d={drop} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#drop-clip)">
        <AnimatedRect x={0} width={24} fill={color} opacity={0.35} animatedProps={fill} />
      </G>
      <Path d={drop} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  )
}

/** Anillo de avance (déficit): se llena hasta `pct` (0..1) al aparecer. */
export function ProgressRing({
  pct,
  size = 54,
  stroke = 7,
  color,
  track,
}: {
  pct: number
  size?: number
  stroke?: number
  color: string
  track: string
}) {
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const target = Math.max(0, Math.min(1, pct))
  const p = useSharedValue(reduce ? target : 0)
  useEffect(() => {
    p.value = reduce
      ? target
      : withDelay(250, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [reduce, target, p])
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }))
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        rotation={-90}
        originX={size / 2}
        originY={size / 2}
        animatedProps={arc}
      />
    </Svg>
  )
}

/** Diana (déficit): el anillo exterior gira a su lugar y el centro aparece. */
export function TargetGlyph({ size = 18, color }: { size?: number; color: string }) {
  const reduce = useReducedMotion()
  const p = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) return
    p.value = withDelay(150, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }))
  }, [reduce, p])
  const c = 2 * Math.PI * 9
  const outer = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }))
  const dot = useAnimatedProps(() => ({ r: 2.6 * Math.max(0, (p.value - 0.5) * 2) }))
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedCircle
        cx={12}
        cy={12}
        r={9}
        stroke={color}
        strokeWidth={1.8}
        strokeDasharray={`${c} ${c}`}
        rotation={-90}
        originX={12}
        originY={12}
        animatedProps={outer}
      />
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={1.8} opacity={0.6} />
      <AnimatedCircle cx={12} cy={12} fill={color} animatedProps={dot} />
    </Svg>
  )
}
