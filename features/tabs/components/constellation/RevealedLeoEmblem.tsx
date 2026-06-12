import { useEffect, useId } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import LeoCabezaArt from '@/assets/zodiac-art/leo-emblem-cabeza.svg'
import LeoJardinArt from '@/assets/zodiac-art/leo-emblem-jardin.svg'
import LeoJardinMono from '@/assets/zodiac-art/leo-emblem-jardin-mono.svg'
import LeoMarcoArt from '@/assets/zodiac-art/leo-emblem-marco.svg'
import LeoMarcoMono from '@/assets/zodiac-art/leo-emblem-marco-mono.svg'
import LeoMelenaArt from '@/assets/zodiac-art/leo-emblem-melena.svg'
import { stageIndexForProgress } from '@/features/emblem'
import { colors, duration, easing } from '@/theme'

/*
 * Emblema Celeste de Leo — reveal por CAPAS ANATÓMICAS.
 *
 * Sistema visual INDEPENDIENTE de la constelación natal:
 *   - La constelación (estrellas + líneas) es evidencia de entrenamiento:
 *     solo responde a "Entrené" y se reinicia cada mes. NO se toca aquí.
 *   - Este emblema es evidencia de TRANSFORMACIÓN: persistente, no se
 *     reinicia, se materializa con la suma de hábitos acumulados.
 *   La constelación responde "¿cuánto me moví este mes?"; el emblema,
 *   "¿en quién me estoy convirtiendo?".
 *
 * El león se materializa ALREDEDOR de la constelación, una parte nueva
 * por etapa (lo revelado nunca se esconde). El arte vive partido en 4
 * SVGs (scripts/split-leo-emblem.mjs):
 *
 *   etapa -1 calma      → nada (el despertar requiere el primer hábito)
 *   etapa 0 despierta   → MARCO en brasa (anillo + glifo + estrellas)
 *   etapa 1 forma       → marco a oro · + JARDÍN en brasa · + CABEZA
 *   etapa 2 revela      → jardín a oro · + MELENA — el león entero
 *   etapa 3 casi        → todo gana presencia · el halo despierta
 *   etapa 4 completo    → oro pleno + halo
 *
 * Performance:
 *   - Los 6 árboles SVG (capas art + mono) son ESTÁTICOS — nunca se
 *     anima nada dentro de un <Svg> (lección MacroRing / scroll-swim).
 *     Solo cambian las opacidades de sus Views envolventes y un scale:
 *     compositor-only, one-shot withTiming al cruzar de etapa.
 *   - UN solo shared value (el índice de etapa, continuo durante la
 *     transición) alimenta todas las capas vía interpolate.
 *   - Montaje perezoso: en calma (-1) no se monta NINGÚN árbol SVG, y
 *     cada capa entra al árbol solo cuando su etapa la puede encender
 *     (ver render) — la memoria GPU crece con el reveal, no por
 *     adelantado.
 */

export type RevealedLeoEmblemProps = {
  /** Progreso de transformación 0–100 (la etapa se deriva adentro). */
  transformProgress: number
}

// Presencia global del emblema: es capa de fondo — la constelación
// sigue siendo el elemento principal. Subir/bajar esto recalibra todo
// el arco sin tocar las curvas por capa.
const MASTER_OPACITY = 0.72
const GLOW_MAX_OPACITY = 0.5

// Bronce apagado de la fase brasa — más oscuro que `oro`, como rescoldo.
const EMBER = '#7A6034'

const GLOW_STOPS = [
  { offset: '0%', color: colors.oroLeche, opacity: 0.16 },
  { offset: '45%', color: colors.oroSoft, opacity: 0.13 },
  { offset: '75%', color: colors.oro, opacity: 0.07 },
  { offset: '100%', color: colors.oro, opacity: 0 },
] as const

export function RevealedLeoEmblem({ transformProgress }: RevealedLeoEmblemProps) {
  const reducedMotion = useReducedMotion()
  // Id ÚNICO por instancia: RNSVG registra los ids de gradiente global-
  // mente, y con detachInactiveScreens=false el hero puede vivir montado
  // en más de un tab a la vez — un id fijo haría que una instancia pise
  // la definición de la otra (halo negro o gradiente ajeno).
  const glowId = `${useId()}-leo-emblem-glow`
  const target = stageIndexForProgress(transformProgress)

  // Seeded en la etapa actual: montar (o volver al tab) nunca re-anima
  // el reveal; solo los CRUCES de etapa se animan.
  const s = useSharedValue(target)

  useEffect(() => {
    s.value = reducedMotion
      ? target
      : withTiming(target, { duration: duration.languid * 2, easing: easing.out })
  }, [target, reducedMotion, s])

  // Cada capa entra al cruzar SU etapa y solo gana presencia después.
  // Marco y jardín nacen en brasa (mono EMBER) y ceden al oro una etapa
  // más tarde — el crossfade brasa→oro es la sensación de "encendido".
  const marcoMonoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [-1, 0, 1], [0, 0.55, 0]),
  }))
  const marcoArtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [0, 1, 2, 3, 4], [0, 0.55, 0.65, 0.85, 1]),
  }))
  const jardinMonoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [0, 1, 2], [0, 0.6, 0]),
  }))
  const jardinArtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [1, 2, 3, 4], [0, 0.65, 0.85, 1]),
  }))
  // La cabeza entra TEMPRANO (etapa "forma"): desde el 26% ya se ve que
  // lo que se construye es el león, no solo ornamenta — un 39% de puro
  // anillo y ramas se lee como bug, no como reveal.
  const cabezaArtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [0, 1, 2, 3, 4], [0, 0.75, 0.85, 0.95, 1]),
  }))
  // La melena completa al león en "revela" — el momento "ah".
  const melenaArtStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [1, 2, 3, 4], [0, 0.8, 0.9, 1]),
  }))

  // Settle de escala compartido — el emblema "se asienta" al crecer.
  const settleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(s.value, [-1, 4], [0.96, 1]) }],
  }))

  // Halo: despierta con la melena ("glow fuerte" en casi-completo) y
  // llega a pleno en 100.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(s.value, [2, 3, 4], [0, 0.35, GLOW_MAX_OPACITY]),
  }))

  // MONTAJE PEREZOSO: cada árbol RNSVG vive en GPU aunque su View esté
  // en opacidad 0, y con detachInactiveScreens=false eso se paga por
  // cada tab que monte el hero. Así que una capa entra al árbol solo
  // cuando su etapa la puede encender (target ≥ su etapa de entrada) y
  // las brasas salen cuando su crossfade ya terminó. Como una capa
  // monta ANTES de que `s` llegue a su nodo de entrada, su fade-in se
  // anima igual que antes: cero sacrificio visual. El reveal nunca
  // retrocede en producción (los puntos solo acumulan); el chip DEV sí
  // baja etapas y ahí las capas salen en seco — aceptable, es dev-only.
  return (
    <View style={[StyleSheet.absoluteFill, styles.master]} pointerEvents="none">
      {target >= 3 ? (
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={glowId} cx="50%" cy="47%" r="52%">
                {GLOW_STOPS.map((g) => (
                  <Stop
                    key={g.offset}
                    offset={g.offset}
                    stopColor={g.color}
                    stopOpacity={g.opacity}
                  />
                ))}
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={47} r={52} fill={`url(#${glowId})`} />
          </Svg>
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, settleStyle]}>
        {target >= 0 && target <= 1 ? (
          <Animated.View style={[StyleSheet.absoluteFill, marcoMonoStyle]}>
            <LeoMarcoMono width="100%" height="100%" color={EMBER} />
          </Animated.View>
        ) : null}
        {target >= 1 ? (
          <Animated.View style={[StyleSheet.absoluteFill, marcoArtStyle]}>
            <LeoMarcoArt width="100%" height="100%" />
          </Animated.View>
        ) : null}
        {target >= 1 && target <= 2 ? (
          <Animated.View style={[StyleSheet.absoluteFill, jardinMonoStyle]}>
            <LeoJardinMono width="100%" height="100%" color={EMBER} />
          </Animated.View>
        ) : null}
        {target >= 2 ? (
          <Animated.View style={[StyleSheet.absoluteFill, jardinArtStyle]}>
            <LeoJardinArt width="100%" height="100%" />
          </Animated.View>
        ) : null}
        {target >= 1 ? (
          <Animated.View style={[StyleSheet.absoluteFill, cabezaArtStyle]}>
            <LeoCabezaArt width="100%" height="100%" />
          </Animated.View>
        ) : null}
        {target >= 2 ? (
          <Animated.View style={[StyleSheet.absoluteFill, melenaArtStyle]}>
            <LeoMelenaArt width="100%" height="100%" />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  master: { opacity: MASTER_OPACITY },
})
