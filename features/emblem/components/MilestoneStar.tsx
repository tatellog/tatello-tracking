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
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg'

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
          </Defs>

          {/* Halo */}
          <Circle cx={60} cy={60} r={58} fill="url(#msHalo)" />
          {/* Chispas en órbita */}
          {SPARKS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.oroLeche} opacity={s.o} />
          ))}
          {/* Brazos del astro */}
          <Path d={STAR_PATH} fill="url(#msArms)" />
          {/* Núcleo magenta sobre el cruce de los brazos */}
          <Circle cx={60} cy={60} r={9} fill="url(#msCore)" />
        </Svg>
      </View>
    </Animated.View>
  )
}
