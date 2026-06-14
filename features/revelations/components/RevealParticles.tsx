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

// Magnitudes pensadas para VERSE (la capa va por DELANTE del card y rebasa
// sus bordes contra el cosmos). El rise es generoso para que las chispas
// suban más allá del card; los sparkles son grandes (estrellas, no puntos).
const TIER: Record<CelebrationTier, TierCfg> = {
  whisper: {
    sparks: 16,
    riseMin: 120,
    riseMax: 220,
    peak: 0.85,
    sparkle4: 3,
    sparkle8: false,
    ring: false,
    durationMs: 1600,
    warm: false,
    magenta: 0,
    descend: false,
  },
  stream: {
    sparks: 24,
    riseMin: 160,
    riseMax: 300,
    peak: 0.9,
    sparkle4: 5,
    sparkle8: false,
    ring: false,
    durationMs: 1900,
    warm: false,
    magenta: 0,
    descend: false,
  },
  rise: {
    sparks: 30,
    riseMin: 200,
    riseMax: 360,
    peak: 0.92,
    sparkle4: 6,
    sparkle8: true,
    ring: false,
    durationMs: 2200,
    warm: false,
    magenta: 0,
    descend: false,
  },
  bloom: {
    sparks: 44,
    riseMin: 160,
    riseMax: 440,
    peak: 0.96,
    sparkle4: 7,
    sparkle8: true,
    ring: true,
    durationMs: 2700,
    warm: false,
    magenta: 5,
    descend: false,
  },
  return: {
    // Regreso: cálido y envolvente, PERO visible (antes casi no se veía).
    sparks: 18,
    riseMin: 60,
    riseMax: 150,
    peak: 0.75,
    sparkle4: 3,
    sparkle8: false,
    ring: false,
    durationMs: 2600,
    warm: true,
    magenta: 0,
    descend: false, // no cae sobre el texto; envuelve por lentitud + tono leche
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
        // Abanico ancho hacia arriba+afuera (radial 360° sesgado-arriba en
        // bloom): las chispas rebasan el card y se ven contra el cosmos.
        angle:
          tier === 'bloom'
            ? -Math.PI / 2 + (rand(i + 1) - 0.5) * 2.6
            : -Math.PI / 2 + (rand(i + 1) - 0.5) * (tier === 'rise' ? 1.7 : 1.2),
        spread: size * 0.34 * (0.4 + rand(i + 3)),
        rise: cfg.riseMin + rand(i + 5) * (cfg.riseMax - cfg.riseMin),
        size: 3 + rand(i + 7) * 4,
        color,
        delay: rand(i + 9) * 260,
        peak: cfg.peak * (0.75 + rand(i + 13) * 0.25),
      })
    }
    return out
  }, [cfg, size, tier])

  const sparkles = useMemo(() => {
    const out: { x: number; y: number; size: number; delay: number }[] = []
    for (let i = 0; i < cfg.sparkle4; i++) {
      // Esparcidos en la mitad superior del campo (cerca del hero) y a los
      // lados, GRANDES: leen como estrellas que estallan, no puntitos.
      out.push({
        x: size * (0.14 + rand(i + 21) * 0.72),
        y: size * (0.1 + rand(i + 23) * 0.42),
        size: 26 + rand(i + 25) * 26,
        delay: 80 + rand(i + 27) * 420,
      })
    }
    return out
  }, [cfg.sparkle4, size])

  return (
    <View style={styles.wrap} pointerEvents="none">
      {/* Campo sesgado HACIA ARRIBA (≈ el hero): las chispas suben y rebasan
          el card por arriba, lejos de la zona de texto (abajo). */}
      <View
        style={[
          styles.field,
          { width: size, height: size, transform: [{ translateY: -size * 0.18 }] },
        ]}
      >
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
