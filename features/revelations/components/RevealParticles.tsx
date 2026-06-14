import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * La "fiesta" de las Revelaciones — celebración manifiesto-safe (dirección
 * de illustrator-specialist + uxui-specialist). Regla física: la luz NACE y
 * ASCIENDE desde el centro (el emblema), NUNCA cae como confeti. Solo
 * oro/leche, magenta como acento puntual. Partículas NATIVAS (Animated.View
 * + SVG, one-shot en UI thread) — no Lottie: la ceremonia ya monta blur +
 * cosmos + Skia. Vive DETRÁS del card (pointerEvents none) y nunca pisa la
 * zona del texto (sube, lejos de la frase).
 *
 * Graduado por tier — el 25% es un susurro, el 100% un estallido pleno, el
 * Regreso ENVUELVE en vez de estallar (cálido, lento, tono leche). El
 * noticing NUNCA monta este componente (no se celebra una observación).
 */

export type CelebrationTier = 'whisper' | 'stream' | 'rise' | 'bloom' | 'return'

/** Mapea el umbral de transformación a su intensidad de fiesta. */
export function tierForThreshold(threshold: number): CelebrationTier {
  if (threshold >= 100) return 'bloom'
  if (threshold >= 75) return 'rise'
  if (threshold >= 50) return 'stream'
  return 'whisper'
}

type TierCfg = {
  sparks: number
  riseMin: number
  riseMax: number
  peak: number
  sparkle4: number
  sparkle8: boolean
  ring: boolean
  durationMs: number
  warm: boolean // tono leche/bone (Regreso) en vez de oro pleno
  magenta: number // chispas magenta de acento (solo bloom)
  descend: boolean // Regreso: envuelve hacia adentro/abajo, no asciende
}

const TIER: Record<CelebrationTier, TierCfg> = {
  whisper: {
    sparks: 7,
    riseMin: 60,
    riseMax: 95,
    peak: 0.7,
    sparkle4: 1,
    sparkle8: false,
    ring: false,
    durationMs: 1400,
    warm: false,
    magenta: 0,
    descend: false,
  },
  stream: {
    sparks: 11,
    riseMin: 100,
    riseMax: 150,
    peak: 0.85,
    sparkle4: 3,
    sparkle8: false,
    ring: false,
    durationMs: 1800,
    warm: false,
    magenta: 0,
    descend: false,
  },
  rise: {
    sparks: 15,
    riseMin: 140,
    riseMax: 200,
    peak: 0.88,
    sparkle4: 4,
    sparkle8: false,
    ring: false,
    durationMs: 2100,
    warm: false,
    magenta: 0,
    descend: false,
  },
  bloom: {
    sparks: 22,
    riseMin: 90,
    riseMax: 230,
    peak: 0.92,
    sparkle4: 2,
    sparkle8: true,
    ring: true,
    durationMs: 2600,
    warm: false,
    magenta: 3,
    descend: false,
  },
  return: {
    sparks: 8,
    riseMin: 28,
    riseMax: 64,
    peak: 0.5,
    sparkle4: 1,
    sparkle8: false,
    ring: false,
    durationMs: 2400,
    warm: true,
    magenta: 0,
    descend: true,
  },
}

// PRNG determinista por índice (sin Math.random en cada render — estable).
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453
  return x - Math.floor(x)
}

type SparkSpec = {
  angle: number
  spread: number
  rise: number
  size: number
  color: string
  delay: number
  peak: number
}

function Spark({
  spec,
  durationMs,
  descend,
}: {
  spec: SparkSpec
  durationMs: number
  descend: boolean
}) {
  const t = useSharedValue(0)
  // Arranca una vez al montar (NUNCA en el cuerpo del render — Reanimated lo
  // prohíbe; correría en cada re-render).
  useEffect(() => {
    t.value = withDelay(
      spec.delay,
      withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) }),
    )
  }, [t, spec.delay, durationMs])

  const style = useAnimatedStyle(() => {
    const dir = descend ? 1 : -1
    return {
      opacity: interpolate(t.value, [0, 0.15, 1], [0, spec.peak, 0]),
      transform: [
        { translateX: Math.cos(spec.angle) * spec.spread * t.value },
        { translateY: dir * spec.rise * t.value },
        { scale: 0.6 + 0.4 * t.value },
      ],
    }
  })

  return (
    <Animated.View
      style={[
        styles.spark,
        {
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  )
}

// Destello de 4 puntas (cóncavo → lee como luz, no diamante). Núcleo leche.
function Sparkle4({
  x,
  y,
  size,
  delay,
  durationMs,
}: {
  x: number
  y: number
  size: number
  delay: number
  durationMs: number
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(
      delay,
      withTiming(1, { duration: durationMs, easing: Easing.out(Easing.cubic) }),
    )
  }, [t, delay, durationMs])
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.2, 1], [0, 0.85, 0]),
    transform: [{ scale: 0.3 + t.value * 0.9 }],
  }))
  return (
    <Animated.View style={[styles.abs, { left: x - size / 2, top: y - size / 2 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 1 C12.5 7 13 9 19 12 C13 15 12.5 17 12 23 C11.5 17 11 15 5 12 C11 9 11.5 7 12 1 Z"
          fill={colors.oroLeche}
        />
      </Svg>
    </Animated.View>
  )
}

// Estallido de 8 puntas + onda anular — solo el clímax (100%). Detrás del emblema.
function Bloom8({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }))
  }, [t, delay])
  const star = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.25, 1], [0, 0.9, 0]),
    transform: [{ scale: 0.4 + t.value * 0.9 }],
  }))
  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.2, 1], [0, 0.5, 0]),
    transform: [{ scale: 0.3 + t.value * 1.5 }],
  }))
  return (
    <View style={styles.center} pointerEvents="none">
      <Animated.View style={[styles.abs, ring]}>
        <Svg width={size * 1.4} height={size * 1.4} viewBox="0 0 64 64">
          <Circle
            cx={32}
            cy={32}
            r={30}
            stroke={colors.oro}
            strokeWidth={0.6}
            opacity={0.55}
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.abs, star]}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 0 C12.4 8 12.6 8.4 16 11 C13.4 11.5 12.5 11.6 12 12 C12.5 12.4 13.4 12.5 16 13 C12.6 15.6 12.4 16 12 24 C11.6 16 11.4 15.6 8 13 C10.6 12.5 11.5 12.4 12 12 C11.5 11.6 10.6 11.5 8 11 C11.4 8.4 11.6 8 12 0 Z"
            fill={colors.oro}
            opacity={0.92}
          />
          <Circle cx={12} cy={12} r={1.8} fill={colors.oroLeche} />
        </Svg>
      </Animated.View>
    </View>
  )
}

type Props = {
  tier: CelebrationTier
  /** Lado de referencia (≈ ancho del emblema/card) sobre el que se dispersan. */
  size: number
}

/** Se monta cuando la ceremonia "estalla"; el padre lo desmonta al terminar. */
export function RevealParticles({ tier, size }: Props) {
  const cfg = TIER[tier]

  const sparks = useMemo<SparkSpec[]>(() => {
    const out: SparkSpec[] = []
    for (let i = 0; i < cfg.sparks; i++) {
      const isMagenta = i < cfg.magenta
      const goldTone = rand(i + 11) > 0.5 ? colors.oroLeche : colors.oro
      const color = isMagenta ? colors.magentaHot : cfg.warm ? colors.bone : goldTone
      out.push({
        // Abanico sesgado hacia arriba (o radial 360° en bloom).
        angle:
          tier === 'bloom'
            ? rand(i + 1) * Math.PI * 2
            : -Math.PI / 2 + (rand(i + 1) - 0.5) * (tier === 'rise' ? 1.4 : 0.9),
        spread: size * 0.18 * (0.4 + rand(i + 3)),
        rise: cfg.riseMin + rand(i + 5) * (cfg.riseMax - cfg.riseMin),
        size: 2 + rand(i + 7) * 2.2,
        color,
        delay: rand(i + 9) * 220,
        peak: cfg.peak * (0.7 + rand(i + 13) * 0.3),
      })
    }
    return out
  }, [cfg, size, tier])

  const sparkles = useMemo(() => {
    const out: { x: number; y: number; size: number; delay: number }[] = []
    for (let i = 0; i < cfg.sparkle4; i++) {
      out.push({
        x: size * (0.3 + rand(i + 21) * 0.4),
        y: size * (0.18 + rand(i + 23) * 0.34),
        size: 14 + rand(i + 25) * 8,
        delay: 120 + rand(i + 27) * 360,
      })
    }
    return out
  }, [cfg.sparkle4, size])

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.field, { width: size, height: size }]}>
        {cfg.sparkle8 ? <Bloom8 size={size * 0.5} delay={140} /> : null}
        <View style={styles.center}>
          {sparks.map((spec, i) => (
            <Spark key={i} spec={spec} durationMs={cfg.durationMs} descend={cfg.descend} />
          ))}
        </View>
        {sparkles.map((s, i) => (
          <Sparkle4
            key={i}
            x={s.x}
            y={s.y}
            size={s.size}
            delay={s.delay}
            durationMs={cfg.durationMs}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  field: { alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  abs: { position: 'absolute' },
  spark: { position: 'absolute' },
})
