import { useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors } from '@/theme'

/*
 * PatternRevealCosmos — el CIELO del modal "Revelación del patrón" (Órbita · Mes).
 *
 * NO es una constelación (decisión de la dueña): el cosmos es el VEHÍCULO de un
 * zoom cinemático. La cámara "vuela" hacia un punto de luz central que florece y,
 * al pasarlo, el cielo se ABRE a un estado CALMO sobre el que se posa la evidencia
 * en texto. Gramática Stelar: negro cálido, crema, oro + magenta; sin frío sci-fi.
 *
 * ── Cómo se anima (lo maneja QUIEN monta el componente) ────────────────────────
 * El arte está en CAPAS SEPARABLES, cada una un `Animated.View` propio que deriva
 * su transform/opacidad de un único `progress` (SharedValue 0→1). La cámara entra
 * con PARALLAX: las capas cercanas escalan más y se desvanecen al "pasar de largo";
 * las lejanas escalan poco y sobreviven como el cielo calmo final.
 *
 *   progress 0 ── cielo profundo, punto de luz lejano y tenue (estado "antes")
 *   progress ~0.5 ── clímax: el bloom casi llena, el polvo cercano pasa de largo
 *   progress 1 ── cielo CALMO: polvo disuelto, estrellas lejanas empujadas a los
 *                  bordes (centro despejado), bloom convertido en glow ambiente
 *                  suave detrás de donde va el texto de evidencia.
 *
 * Capas (de fondo a frente), cada una exportada + identificable:
 *   FarStars     · muchas estrellas finas y tenues — escalan poco (fondo lejano)
 *   MidStars     · estrellas medias — parallax intermedio, se atenúan al final
 *   NearDust     · polvo/nebulosa cercano (radiales magenta) — pasa de largo y se va
 *   CentralBloom · el punto de luz que florece — hacia el que "vuela" la cámara
 *
 * ── Perf / Android release ─────────────────────────────────────────────────────
 * NO Skia (integración sin fricción). Las estrellas son <View> puros: el parallax
 * escala el <Animated.View> contenedor (op de compositor), NO se re-rasteriza nada
 * por frame. El polvo y el bloom son <Svg> ESTÁTICOS (radial gradient dibujado una
 * vez); solo se anima el <Animated.View> que los envuelve — evita el bug conocido
 * de re-rasterización de RNSVG en animación y el de rotate-en-transform-array. NO
 * se animan props internas de SVG.
 *
 * Reduce-motion / estado estático: si `progress` no se pasa (o no se anima), el
 * componente cae en su estado final CALMO por defecto (progress = 1), que se ve
 * bien fijo. El titileo idle es sutil y se apaga con reduce-motion.
 */

// ── Coordenadas normalizadas 0..1 (viewport-agnóstico) ─────────────────────────
type FieldStar = {
  /** 0..1 dentro del viewport */
  x: number
  y: number
  /** px */
  size: number
  opacity: number
  /** true → añade un halo crema tenue (solo estrellas cercanas/brillantes) */
  halo: boolean
}

/*
 * Campo determinístico (mismo hash-jitter que el resto del cosmos de Stelar, para
 * que el cielo no se rebaraje entre renders). Se siembra al cargar el módulo.
 * Se deja un "pozo" central más despejado (menos estrellas cerca del centro) para
 * que el clímax del bloom y, después, el texto de evidencia respiren.
 */
function buildField(count: number, seed: number, sizeMin: number, sizeMax: number): FieldStar[] {
  const out: FieldStar[] = []
  let i = seed
  let placed = 0
  let guard = 0
  while (placed < count && guard < count * 6) {
    guard++
    const h1 = Math.sin(i * 12.9898 + 4.1) * 43758.5453
    const h2 = Math.sin(i * 78.233 + 2.7) * 24634.6345
    const f = Math.abs(Math.sin(i * 51.17 + 9.1))
    i++
    const x = h1 - Math.floor(h1)
    const y = h2 - Math.floor(h2)
    // Descartamos parte de las que caen en el pozo central → centro más limpio.
    const d = Math.hypot(x - 0.5, y - 0.5)
    if (d < 0.16 && f < 0.6) continue
    out.push({
      x,
      y,
      size: sizeMin + f * (sizeMax - sizeMin),
      opacity: 0.22 + f * 0.5,
      halo: f > 0.82,
    })
    placed++
  }
  return out
}

const FAR_STARS = buildField(44, 3, 0.7, 1.5)
const MID_STARS = buildField(20, 131, 1.3, 2.6)

// ── Rangos de interpolación del zoom (progress 0→1) ────────────────────────────
// Escala: las capas cercanas escalan MÁS (rushing past) que las lejanas.
const FAR_SCALE = [1, 1.5] as const
const MID_SCALE = [1, 2.4] as const
const DUST_SCALE = [1, 5.2] as const
const BLOOM_SCALE = [0.3, 3.6] as const

const CLAMP = Extrapolation.CLAMP

// ── Estrellas puras en <View> (una capa entera) ────────────────────────────────
function StarViews({
  stars,
  width,
  height,
}: {
  stars: FieldStar[]
  width: number
  height: number
}) {
  return (
    <>
      {stars.map((s, idx) => {
        const left = s.x * width
        const top = s.y * height
        return (
          <View key={idx} pointerEvents="none">
            {s.halo ? (
              <View
                style={[
                  styles.dot,
                  {
                    left: left - s.size * 2.4,
                    top: top - s.size * 2.4,
                    width: s.size * 4.8,
                    height: s.size * 4.8,
                    borderRadius: s.size * 2.4,
                    opacity: s.opacity * 0.28,
                  },
                ]}
              />
            ) : null}
            <View
              style={[
                styles.dot,
                {
                  left: left - s.size / 2,
                  top: top - s.size / 2,
                  width: s.size,
                  height: s.size,
                  borderRadius: s.size / 2,
                  opacity: s.opacity,
                },
              ]}
            />
          </View>
        )
      })}
    </>
  )
}

// ── CAPA A · estrellas lejanas ─────────────────────────────────────────────────
export function FarStars({
  progress,
  idle,
  width,
  height,
}: {
  progress: SharedValue<number>
  idle: SharedValue<number>
  width: number
  height: number
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], FAR_SCALE, CLAMP)
    // Sobreviven como el cielo calmo: nunca se apagan del todo. Idle ±4%.
    const base = interpolate(progress.value, [0, 0.5, 1], [0.55, 0.9, 0.78], CLAMP)
    const breath = 0.96 + 0.04 * idle.value
    return { opacity: base * breath, transform: [{ scale }] }
  })
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
      <StarViews stars={FAR_STARS} width={width} height={height} />
    </Animated.View>
  )
}

// ── CAPA B · estrellas medias ──────────────────────────────────────────────────
export function MidStars({
  progress,
  idle,
  width,
  height,
}: {
  progress: SharedValue<number>
  idle: SharedValue<number>
  width: number
  height: number
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], MID_SCALE, CLAMP)
    // Pasan de largo: brillan al acercarse y se atenúan hacia el cielo calmo.
    const base = interpolate(progress.value, [0, 0.45, 1], [0.6, 0.95, 0.28], CLAMP)
    const breath = 0.94 + 0.06 * idle.value
    return { opacity: base * breath, transform: [{ scale }] }
  })
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
      <StarViews stars={MID_STARS} width={width} height={height} />
    </Animated.View>
  )
}

// ── CAPA C · polvo / nebulosa cercano ──────────────────────────────────────────
// Dos radiales magenta/violeta enmarcando el centro. <Svg> ESTÁTICO y CENTRADO:
// solo se anima el contenedor. Rushing past → escala mucho y se disuelve.
export function NearDust({ progress, size }: { progress: SharedValue<number>; size: number }) {
  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], DUST_SCALE, CLAMP)
    // Presente al inicio, pasa de largo y desaparece (cielo calmo sin polvo cercano).
    const opacity = interpolate(progress.value, [0, 0.4, 0.8, 1], [0.32, 0.5, 0.06, 0], CLAMP)
    return { opacity, transform: [{ scale }] }
  })
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.center, animatedStyle]}
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="prc-dustA" cx="32%" cy="36%" r="55%">
            <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.34} />
            <Stop offset="55%" stopColor={colors.magentaDeep} stopOpacity={0.12} />
            <Stop offset="100%" stopColor={colors.magentaDeep} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="prc-dustB" cx="70%" cy="68%" r="52%">
            <Stop offset="0%" stopColor="#7A2A60" stopOpacity={0.3} />
            <Stop offset="60%" stopColor="#5A2A64" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#5A2A64" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={32} cy={36} r={55} fill="url(#prc-dustA)" />
        <Circle cx={70} cy={68} r={52} fill="url(#prc-dustB)" />
      </Svg>
    </Animated.View>
  )
}

// ── CAPA D · el punto de luz central que florece ───────────────────────────────
// El foco hacia el que vuela la cámara. Núcleo oro → magenta → transparente, con un
// glint de 4 puntas (firma Stelar) en el corazón. Dos wrappers ESTÁTICOS de SVG:
//   · bloomWrap   — escala + opacidad (el "vuelo" hacia la luz y su disolución)
//   · glintWrap   — solo opacidad, sin escala (glint crujiente que pulsa y se apaga
//                   antes del texto; no crece con el bloom para no volverse enorme)
export function CentralBloom({
  progress,
  idle,
  size,
}: {
  progress: SharedValue<number>
  idle: SharedValue<number>
  size: number
}) {
  const bloomStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], BLOOM_SCALE, CLAMP)
    // Se acerca y brilla (0→0.5), luego se disuelve en glow ambiente calmo (→1).
    const base = interpolate(progress.value, [0, 0.5, 0.75, 1], [0.12, 0.9, 0.55, 0.28], CLAMP)
    const breath = 0.9 + 0.1 * idle.value
    return { opacity: base * breath, transform: [{ scale }] }
  })
  const glintStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.5, 0.85, 1], [0.15, 0.9, 0.35, 0], CLAMP)
    return { opacity }
  })

  const star = fourPointStarPath(50, 50, 15)

  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, bloomStyle]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="prc-bloomHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.oroLeche} stopOpacity={0.9} />
              <Stop offset="22%" stopColor={colors.oro} stopOpacity={0.5} />
              <Stop offset="55%" stopColor={colors.magenta} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={colors.magentaDeep} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="prc-bloomCore" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.oroLeche} stopOpacity={1} />
              <Stop offset="60%" stopColor={colors.oroLight} stopOpacity={0.6} />
              <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={48} fill="url(#prc-bloomHalo)" />
          <Circle cx={50} cy={50} r={16} fill="url(#prc-bloomCore)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.center, glintStyle]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Path d={star} fill={colors.oroLeche} />
        </Svg>
      </Animated.View>
    </>
  )
}

// ── Componente compuesto ───────────────────────────────────────────────────────
type PatternRevealCosmosProps = {
  /** Ancho del viewport (px). */
  width: number
  /** Alto del viewport (px). */
  height: number
  /**
   * El zoom, 0→1. Lo animás vos desde afuera (one-shot). Si no se pasa, el cosmos
   * queda en su estado final CALMO (progress = 1), listo para el texto encima.
   */
  progress?: SharedValue<number>
  /** Override de reduce-motion (por defecto usa el del sistema). */
  reducedMotion?: boolean
  style?: StyleProp<ViewStyle>
}

export function PatternRevealCosmos({
  width,
  height,
  progress,
  reducedMotion,
  style,
}: PatternRevealCosmosProps) {
  const systemReduced = useReducedMotion() ?? false
  const reduced = reducedMotion ?? systemReduced

  // Fallback: sin `progress` → estado final calmo, fijo.
  const fallbackProgress = useSharedValue(1)
  const p = progress ?? fallbackProgress

  // Titileo idle del cielo calmo: respiro global casi imperceptible. Se apaga con
  // reduce-motion. Es el ÚNICO loop continuo; el zoom en sí es one-shot y externo.
  const idle = useSharedValue(0.5)
  useEffect(() => {
    if (reduced) {
      cancelAnimation(idle)
      idle.value = 0.5
      return
    }
    idle.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(idle)
  }, [reduced, idle])

  // El bloom + polvo se dibujan en un lienzo cuadrado del lado mayor, centrado, para
  // que el radial cubra los bordes al escalar.
  const canvas = Math.max(width, height)

  return (
    <View style={[styles.root, { width, height }, style]} pointerEvents="none">
      <FarStars progress={p} idle={idle} width={width} height={height} />
      <MidStars progress={p} idle={idle} width={width} height={height} />
      <NearDust progress={p} size={canvas} />
      <CentralBloom progress={p} idle={idle} size={canvas} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    backgroundColor: colors.leche,
  },
})
