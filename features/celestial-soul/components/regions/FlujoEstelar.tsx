import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Polyline } from 'react-native-svg'

import { flujoStreamsForSign } from '../../config'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors } from '@/theme'

/*
 * Región 4 — Flujo Estelar. Las CORRIENTES (cabello / energía) de la figura.
 * Estado inicial: líneas tenues. Despierta: luz que VIAJA por las corrientes
 * (stardust fluyendo). Significado: impulso. Se coloca por el NODE-MAP del signo
 * (polilíneas trazadas sobre el arte, `flujoStreamsForSign`), no por geometría.
 *
 * Perf: una línea SVG estática por corriente (transparente salvo el trazo fino)
 * + pocas partículas (Views) que recorren la polilínea leyendo UN shared value
 * (translate + opacity, compositor). El recorrido se interpola en el worklet
 * sobre segmentos precomputados — sin llamar helpers externos.
 */

const PARTICLES_PER_STREAM = 3

type Seg = { x0: number; y0: number; x1: number; y1: number; len: number }

// Convierte una corriente (puntos 0..1) a px + segmentos con longitud
// normalizada (suman 1) + el string de la polilínea para el SVG.
function buildStream(points: readonly { x: number; y: number }[], artSize: number) {
  const px = points.map((p) => ({ x: p.x * artSize, y: p.y * artSize }))
  const raw: Seg[] = []
  let total = 0
  for (let i = 0; i < px.length - 1; i++) {
    const a = px[i]!
    const b = px[i + 1]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    total += len
    raw.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, len })
  }
  const segs = raw.map((s) => ({ ...s, len: total > 0 ? s.len / total : 0 }))
  const poly = px.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return { segs, poly }
}

export function FlujoEstelar({
  sign,
  artSize,
  pct,
}: {
  sign: ZodiacSign
  artSize: number
  pct: number
}) {
  const reduced = useReducedMotion() ?? false
  const intensity = Math.max(0, Math.min(1, pct / 100))
  const t = useSharedValue(0)

  const streams = useMemo(
    () => flujoStreamsForSign(sign).map((s) => buildStream(s, artSize)),
    [sign, artSize],
  )

  useEffect(() => {
    if (reduced) return
    t.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [reduced, t])

  if (intensity <= 0) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* corrientes — trazo fino y tenue (la "ruta" que la luz recorre) */}
      <Svg width={artSize} height={artSize} style={StyleSheet.absoluteFill} pointerEvents="none">
        {streams.map((st, i) => (
          <Polyline
            key={i}
            points={st.poly}
            fill="none"
            stroke={colors.oro}
            strokeWidth={0.8}
            strokeOpacity={0.1 + 0.12 * intensity}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>

      {/* partículas que fluyen por cada corriente */}
      {streams.map((st, i) =>
        st.segs.length > 0
          ? Array.from({ length: PARTICLES_PER_STREAM }, (_, j) => (
              <FlujoParticle
                key={`${i}-${j}`}
                t={t}
                segs={st.segs}
                phase={j / PARTICLES_PER_STREAM}
                intensity={intensity}
                reduced={reduced}
              />
            ))
          : null,
      )}
    </View>
  )
}

function FlujoParticle({
  t,
  segs,
  phase,
  intensity,
  reduced,
}: {
  t: SharedValue<number>
  segs: Seg[]
  phase: number
  intensity: number
  reduced: boolean
}) {
  const style = useAnimatedStyle(() => {
    // 0..1 a lo largo de la corriente (+1)%1 garantiza no-negativo
    const tt = (((reduced ? phase : t.value + phase) % 1) + 1) % 1
    let acc = 0
    let x = segs[0]!.x0
    let y = segs[0]!.y0
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!
      const next = acc + s.len
      if (tt <= next || i === segs.length - 1) {
        const local = s.len > 0 ? (tt - acc) / s.len : 0
        x = s.x0 + (s.x1 - s.x0) * local
        y = s.y0 + (s.y1 - s.y0) * local
        break
      }
      acc = next
    }
    const fade = Math.sin(tt * Math.PI) // se desvanece en los extremos
    return {
      opacity: intensity * 0.95 * fade,
      transform: [{ translateX: x }, { translateY: y }],
    }
  })

  return <Animated.View style={[styles.dot, style]} />
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 2.4,
    height: 2.4,
    marginLeft: -1.2,
    marginTop: -1.2,
    borderRadius: 1.2,
    backgroundColor: colors.oroSoft,
  },
})
