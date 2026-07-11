import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * DiscoveryWave — el visual de Stelar mientras "lee tu mes".
 *
 * METÁFORA: una mini-constelación que se dibuja sola. Aparecen puntos-estrella
 * uno a uno y se van CONECTANDO con líneas finas doradas (literal "encontrando
 * conexiones"). Al completarse, el conjunto respira y se disuelve suavemente
 * para volver a empezar · loop lento y ceremonial, en oro (no magenta).
 *
 * Reemplaza al ecualizador de barras (se sentía a grabación de voz, no a
 * lectura/análisis). Todo corre en UI thread: un solo progreso `draw` dibuja la
 * constelación (estrellas via opacity/scale, líneas via strokeDashoffset) y un
 * `breath` independiente le da el pulso vivo. Ambos loops se cancelan al
 * desmontar. Color estático · solo se animan opacity/scale/dashoffset.
 */

// Constelación en coordenadas de viewBox (VB_W x VB_H). Forma que asciende y
// se asienta · sugiere trayectoria, no ruido.
const VB_W = 200
const VB_H = 72

type StarDef = { x: number; y: number; appear: number; twinkle: number }
const STARS: StarDef[] = [
  { x: 18, y: 50, appear: 0.0, twinkle: 0.0 },
  { x: 52, y: 30, appear: 0.08, twinkle: 1.3 },
  { x: 88, y: 44, appear: 0.16, twinkle: 2.6 },
  { x: 120, y: 21, appear: 0.24, twinkle: 0.7 },
  { x: 156, y: 40, appear: 0.32, twinkle: 3.4 },
  { x: 186, y: 26, appear: 0.4, twinkle: 1.9 },
]

type EdgeDef = {
  x1: number
  y1: number
  x2: number
  y2: number
  len: number
  start: number
  dur: number
}
// Camino secuencial 0→5 + una cuerda (1-3): la "conexión encontrada".
const EDGE_PAIRS: [number, number, number][] = [
  [0, 1, 0.1],
  [1, 2, 0.2],
  [2, 3, 0.28],
  [3, 4, 0.36],
  [4, 5, 0.44],
  [1, 3, 0.52],
]
const EDGES: EdgeDef[] = EDGE_PAIRS.map(([a, b, start]) => {
  const s = STARS[a]!
  const e = STARS[b]!
  return {
    x1: s.x,
    y1: s.y,
    x2: e.x,
    y2: e.y,
    len: Math.hypot(e.x - s.x, e.y - s.y),
    start,
    dur: 0.16,
  }
})

const STAR_R = 2.4
const GLOW_R = 7

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

function smoothstep(edge0: number, edge1: number, x: number) {
  'worklet'
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function DiscoveryWave({ width = 220 }: { width?: number }) {
  const height = Math.round((width * VB_H) / VB_W)

  // draw: dibuja/disuelve la constelación (0→1, loop). Empieza y termina vacía
  // → el reinicio es imperceptible. breath: pulso continuo e independiente.
  const draw = useSharedValue(0)
  const breath = useSharedValue(0)

  useEffect(() => {
    draw.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false)
    breath.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => {
      cancelAnimation(draw)
      cancelAnimation(breath)
    }
  }, [draw, breath])

  const groupStyle = useAnimatedStyle(() => {
    const s = 0.985 + 0.03 * breath.value
    return {
      opacity: 0.9 + 0.1 * breath.value,
      transform: [{ scale: s }],
    }
  })

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Animated.View style={groupStyle}>
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          {EDGES.map((e, i) => (
            <Edge key={`e${i}`} edge={e} draw={draw} />
          ))}
          {STARS.map((s, i) => (
            <Star key={`s${i}`} star={s} draw={draw} breath={breath} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  )
}

function Edge({ edge, draw }: { edge: EdgeDef; draw: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const grown = smoothstep(edge.start, edge.start + edge.dur, draw.value)
    const fade = 1 - smoothstep(0.84, 1, draw.value)
    return {
      strokeDashoffset: edge.len * (1 - grown),
      strokeOpacity: grown * fade * 0.85,
    }
  })
  return (
    <AnimatedLine
      x1={edge.x1}
      y1={edge.y1}
      x2={edge.x2}
      y2={edge.y2}
      stroke={colors.oroVect}
      strokeWidth={1}
      strokeLinecap="round"
      strokeDasharray={edge.len}
      animatedProps={props}
    />
  )
}

function Star({
  star,
  draw,
  breath,
}: {
  star: StarDef
  draw: SharedValue<number>
  breath: SharedValue<number>
}) {
  const coreProps = useAnimatedProps(() => {
    const appear = smoothstep(star.appear, star.appear + 0.12, draw.value)
    const fade = 1 - smoothstep(0.84, 1, draw.value)
    // Titileo sutil, desfasado por estrella (breath es un tri-wave 0→1).
    const twinkle = 0.78 + 0.22 * Math.sin(breath.value * 6.2832 + star.twinkle)
    return {
      opacity: appear * fade * twinkle,
      r: STAR_R * (0.55 + 0.45 * appear),
    }
  })

  const glowProps = useAnimatedProps(() => {
    const appear = smoothstep(star.appear, star.appear + 0.12, draw.value)
    const fade = 1 - smoothstep(0.84, 1, draw.value)
    return { opacity: appear * fade * 0.5 }
  })

  return (
    <>
      <AnimatedCircle
        cx={star.x}
        cy={star.y}
        r={GLOW_R}
        fill={colors.oroGlow}
        animatedProps={glowProps}
      />
      <AnimatedCircle cx={star.x} cy={star.y} fill={colors.oroLight} animatedProps={coreProps} />
    </>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
})
