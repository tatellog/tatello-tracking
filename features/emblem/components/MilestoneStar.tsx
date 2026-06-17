import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

import { colors } from '@/theme'

/**
 * "El astro" — la estrella-hito de cuatro puntas (núcleo magenta, brazos oro,
 * halo radial y chispas en órbita). El ancla visual de la anticipación: lo que
 * sigue se ve como un astro a punto de encenderse, no como una línea de texto.
 *
 * SVG estático (NO Skia): el modal pinta el león en RN <Image> a propósito para
 * no chocar TextureViews con el hero de Skia detrás; este astro respeta esa
 * regla. La respiración vive en un Animated.View que SOLO transforma escala +
 * opacidad del contenedor — nunca anima hijos del SVG, así no re-rasteriza el
 * árbol (el perf-killer de react-native-svg). Reduce-motion lo deja quieto.
 *
 * Reusable por tamaño; el viewBox 120 deja aire para el halo y las chispas.
 */
type MilestoneStarProps = {
  size?: number
}

// Estrella de 4 puntas con cintura cóncava (la "chispa" clásica): controles
// tirados hacia el centro curvan los lados hacia adentro. Centro 60, radio 40.
const STAR_PATH =
  'M60 20 C64 44 76 56 100 60 C76 64 64 76 60 100 C56 76 44 64 20 60 C44 56 56 44 60 20 Z'

// Glints diagonales: rombos finísimos a 45° (puntas a ±32 del centro, cintura
// ±0.7). Rellenan los huecos entre los brazos cardinales → flare de 8 puntas.
const GLINT_NE_SW = 'M92 28 L60.7 60.7 L28 92 L59.3 59.3 Z'
const GLINT_NW_SE = 'M28 28 L60.7 59.3 L92 92 L59.3 60.7 Z'

// Chispas en órbita — posiciones fijas (no random: no parpadean entre renders),
// repartidas en el anillo lejos del núcleo, con radios y brillos distintos.
const SPARKS = [
  { x: 26, y: 30, r: 2.2, o: 0.7 },
  { x: 96, y: 34, r: 1.6, o: 0.55 },
  { x: 101, y: 86, r: 2, o: 0.6 },
  { x: 30, y: 96, r: 1.4, o: 0.5 },
  { x: 17, y: 64, r: 1.2, o: 0.42 },
  { x: 92, y: 68, r: 1.8, o: 0.55 },
] as const

export function MilestoneStar({ size = 88 }: MilestoneStarProps) {
  const reduce = useReducedMotion()
  // Respiración: una escala lenta del contenedor (transform de View, GPU —
  // no toca el SVG). Reduce-motion la deja en 1.
  const breath = useSharedValue(1)
  useEffect(() => {
    if (reduce) {
      breath.value = 1
      return
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
  }, [reduce, breath])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
    // Opacidad sutil acompañando la respiración (sin tocar el SVG).
    opacity: 0.92 + (breath.value - 1) * 1.6,
  }))

  return (
    <Animated.View style={[{ width: size, height: size }, animatedStyle]}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 120 120">
          <Defs>
            {/* Halo cálido detrás del astro — oro al centro que cede a magenta. */}
            <RadialGradient id="msHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.oro} stopOpacity={0.42} />
              <Stop offset="34%" stopColor={colors.dimension.energia} stopOpacity={0.22} />
              <Stop offset="64%" stopColor={colors.magenta} stopOpacity={0.12} />
              <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
            </RadialGradient>
            {/* Brazos del astro — luz arriba, oro al medio, ámbar abajo. */}
            <LinearGradient id="msArms" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.oroLeche} />
              <Stop offset="48%" stopColor={colors.oro} />
              <Stop offset="100%" stopColor={colors.dimension.energia} />
            </LinearGradient>
            {/* Núcleo — magenta vivo que se apaga hacia su borde. */}
            <RadialGradient id="msCore" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.oroLeche} stopOpacity={0.95} />
              <Stop offset="42%" stopColor={colors.magenta} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors.magentaDeep} stopOpacity={0.9} />
            </RadialGradient>
            {/* Bloom central — el destello blanco-cálido de donde nace la luz. */}
            <RadialGradient id="msBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.oroLeche} stopOpacity={0.9} />
              <Stop offset="40%" stopColor={colors.oroLeche} stopOpacity={0.28} />
              <Stop offset="100%" stopColor={colors.oroLeche} stopOpacity={0} />
            </RadialGradient>
            {/* Flares anamórficos — la raya de luz que cruza el núcleo, brillante
                al centro y desvanecida a las puntas. Horizontal y vertical. */}
            <LinearGradient id="msFlareH" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={colors.oroLeche} stopOpacity={0} />
              <Stop offset="30%" stopColor={colors.oroLeche} stopOpacity={0.16} />
              <Stop offset="50%" stopColor={colors.oroLeche} stopOpacity={0.95} />
              <Stop offset="70%" stopColor={colors.oroLeche} stopOpacity={0.16} />
              <Stop offset="100%" stopColor={colors.oroLeche} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="msFlareV" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.oroLeche} stopOpacity={0} />
              <Stop offset="32%" stopColor={colors.oroLeche} stopOpacity={0.14} />
              <Stop offset="50%" stopColor={colors.oroLeche} stopOpacity={0.85} />
              <Stop offset="68%" stopColor={colors.oroLeche} stopOpacity={0.14} />
              <Stop offset="100%" stopColor={colors.oroLeche} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Halo */}
          <Circle cx={60} cy={60} r={58} fill="url(#msHalo)" />
          {/* Chispas en órbita */}
          {SPARKS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.oroLeche} opacity={s.o} />
          ))}
          {/* Glints diagonales — 4 destellos finos a 45° que, con los brazos
              cardinales, arman una estrella de 8 puntas de luz. */}
          <Path d={GLINT_NE_SW} fill={colors.oroLeche} opacity={0.5} />
          <Path d={GLINT_NW_SE} fill={colors.oroLeche} opacity={0.5} />
          {/* Brazos del astro */}
          <Path d={STAR_PATH} fill="url(#msArms)" />
          {/* Bloom central detrás del núcleo */}
          <Circle cx={60} cy={60} r={26} fill="url(#msBloom)" />
          {/* Flares anamórficos — luz que dispara más allá de los brazos */}
          <Rect x={0} y={57.4} width={120} height={5.2} fill="url(#msFlareH)" />
          <Rect x={57.4} y={0} width={5.2} height={120} fill="url(#msFlareV)" />
          {/* Raya crujiente fina sobre el cruce (el glint nítido del lente) */}
          <Rect x={6} y={59.2} width={108} height={1.6} fill="url(#msFlareH)" />
          <Rect x={59.2} y={10} width={1.6} height={100} fill="url(#msFlareV)" />
          {/* Núcleo magenta sobre el cruce de los brazos */}
          <Circle cx={60} cy={60} r={9} fill="url(#msCore)" />
          {/* Punto caliente — el destello blanco en el corazón del núcleo */}
          <Circle cx={60} cy={60} r={2.6} fill={colors.oroLeche} opacity={0.95} />
        </Svg>
      </View>
    </Animated.View>
  )
}
