import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { ScreenCosmos } from '@/features/orbit/components/Cosmos'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { RevealedEmblem } from '@/features/tabs/components/constellation/RevealedEmblem'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { type CelebrationTier, RevealParticles, tierForThreshold } from './RevealParticles'

/*
 * Ceremonia de Transformación (T1) — el momento full-screen cuando el
 * emblema cruza 25/50/75/100 % por primera vez. Sobre Hoy difuminado y
 * pausado: el emblema (al nuevo %) se materializa al centro, la frase del
 * coach llega, y un CTA lleva a Órbita. Hermano de PatternReveal (patrones
 * /regreso) — misma gramática visual, pero el héroe aquí es el emblema, no
 * una constelación de patrón. Spec: docs/revelations-system-spec.md.
 */

type Props = {
  sign: ZodiacSign
  /** % al que se materializa el emblema: el umbral cruzado (25/50/75/100)
   *  para T1, o el PROGRESO ACTUAL para el Regreso ("tu cielo te esperó"
   *  donde lo dejaste). */
  threshold: number
  /** Copy de la etapa (voz del coach), provisto por el orquestador. */
  message: string
  onClose: () => void
  /** 'transformation' (default) = hito del emblema · 'return' = bienvenida
   *  tras una ausencia. El hero es el MISMO emblema; cambian eyebrow, CTA,
   *  haptic y la intensidad de la fiesta (return = cálida, no estallido). */
  variant?: 'transformation' | 'return'
}

export function TransformationReveal({
  sign,
  threshold,
  message,
  onClose,
  variant = 'transformation',
}: Props) {
  const { width, height } = useWindowDimensions()
  const reduced = useReducedMotion() ?? false
  const router = useRouter()

  const emblemSize = Math.min(width - 96, 300)
  const isReturn = variant === 'return'
  const tier: CelebrationTier = isReturn ? 'return' : tierForThreshold(threshold)
  const eyebrow = isReturn ? 'TU CIELO' : `TU TRANSFORMACIÓN · ${threshold}%`

  const enter = useSharedValue(0)
  const emblem = useSharedValue(0)
  // La fiesta entra DESPUÉS de que el emblema se materializa (~1 s) y vive
  // detrás del card; se desmonta sola al terminar. Apagada en reduce-motion.
  const [party, setParty] = useState(false)

  useEffect(() => {
    if (reduced) {
      enter.value = withTiming(1, { duration: 320 })
      emblem.value = withTiming(1, { duration: 360 })
      return
    }
    enter.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
    emblem.value = withDelay(
      240,
      withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
    )
    // Regreso: un solo Light suave (alivio, no fanfarria). Hitos: Success
    // (+ un 2º Light en el 100%, abajo).
    if (isReturn) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }

    // Regreso (sin emblema): la lluvia de estrellas cálida entra pronto, así
    // el "cielo que te esperó" se siente vivo de inmediato.
    const start = setTimeout(() => setParty(true), isReturn ? 400 : 1000)
    const stop = setTimeout(() => setParty(false), isReturn ? 3600 : 4000)
    // El 100% pesa más: un segundo beat (Light) al florecer el estallido.
    const bloomBeat =
      tier === 'bloom'
        ? setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          }, 1450)
        : undefined
    return () => {
      clearTimeout(start)
      clearTimeout(stop)
      if (bloomBeat) clearTimeout(bloomBeat)
    }
  }, [reduced, enter, emblem, tier, isReturn])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: enter.value }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.9 + enter.value * 0.1 }],
  }))
  const emblemStyle = useAnimatedStyle(() => ({
    opacity: emblem.value,
    transform: [{ scale: 0.7 + emblem.value * 0.3 }],
  }))

  const close = (): void => {
    Haptics.selectionAsync().catch(() => {})
    onClose()
  }
  const goToOrbit = (): void => {
    requestOrbitSegment('mes')
    router.navigate({ pathname: '/orbit' })
    onClose()
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        <ScreenCosmos width={width} height={height} />
      </Animated.View>

      <Pressable style={[StyleSheet.absoluteFill, styles.center]} onPress={close}>
        {/* El card absorbe sus taps (no cierra al tocar el contenido). */}
        <Pressable onPress={() => {}}>
          <Animated.View
            style={[styles.card, { width: Math.min(width - 56, 360) }, cardStyle]}
            accessibilityViewIsModal
          >
            {/* Cerrar explícito — además del tap en el fondo, un afford claro
                para no perder el momento por un toque accidental. */}
            <Pressable
              onPress={close}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={styles.closeBtn}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>

            {/* El % vive EN el eyebrow (no como número grande arriba del
                emblema): el héroe visual es el emblema, no un dato frío.
                En Regreso el eyebrow es "TU CIELO" (sin número). */}
            <Text style={styles.eyebrow}>{eyebrow}</Text>

            {/* El emblema es el hero SOLO de la Transformación. El Regreso NO
                tiene hero (decisión del owner): el cosmos vivo + la lluvia de
                estrellas cálida son el "cielo que te esperó"; la tarjeta queda
                mínima (eyebrow + frase + "Aquí sigo"). El contenedor del
                emblema lleva tamaño explícito porque RevealedEmblem usa
                absoluteFill (sin width/height quedaría 0×0). */}
            {isReturn ? (
              <View style={styles.returnGap} />
            ) : (
              <Animated.View
                style={[styles.emblemWrap, { width: emblemSize, height: emblemSize }, emblemStyle]}
                pointerEvents="none"
                accessibilityRole="image"
                accessibilityLabel={`Tu emblema al ${threshold} por ciento`}
              >
                <RevealedEmblem sign={sign} transformProgress={threshold} size={emblemSize} />
              </Animated.View>
            )}

            <Animated.Text
              entering={FadeIn.duration(420).delay(reduced ? 200 : isReturn ? 500 : 900)}
              style={styles.message}
            >
              {message}
            </Animated.Text>

            <Animated.View
              entering={FadeIn.duration(360).delay(reduced ? 300 : 1200)}
              style={styles.ctaWrap}
            >
              {isReturn ? (
                // Regreso: una sola salida cálida — no se "va a ver" nada,
                // solo se reafirma la presencia.
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
                >
                  <Text style={styles.ctaPrimaryText}>Aquí sigo</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={goToOrbit}
                    style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
                  >
                    <Text style={styles.ctaPrimaryText}>Verlo en mi órbita</Text>
                  </Pressable>
                  <Pressable
                    onPress={close}
                    hitSlop={10}
                    style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}
                  >
                    <Text style={styles.ctaSecondaryText}>Lo veo</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Pressable>

      {/* La fiesta — POR DELANTE del card (es opaco; detrás quedaba tapada).
          Irradia desde el hero hacia arriba/afuera contra el cosmos, lejos de
          la zona de texto. pointerEvents none → no bloquea el tap-fondo. */}
      {party ? <RevealParticles tier={tier} width={width} height={height} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.bg, opacity: 0.5 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '-4%',
  },
  card: {
    backgroundColor: '#1A0C11',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(217,174,111,0.28)',
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: colors.oro,
    shadowOpacity: 0.3,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 3.2,
    color: colors.oro,
    textAlign: 'center',
  },
  emblemWrap: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Regreso sin hero: un respiro entre el eyebrow y la frase (la tarjeta es
  // mínima; el cosmos + la lluvia de estrellas hacen el trabajo visual).
  returnGap: {
    height: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeIcon: {
    fontFamily: typography.ui,
    fontSize: 15,
    color: colors.leche,
    opacity: 0.7,
  },
  message: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 22,
    lineHeight: 30,
    color: colors.leche,
    textAlign: 'center',
  },
  ctaWrap: {
    alignItems: 'center',
    marginTop: 22,
  },
  ctaPrimary: {
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 42,
    backgroundColor: colors.oro,
    shadowColor: colors.oro,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ctaPrimaryText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.3,
    color: colors.bg,
  },
  // Pill outline (no texto-tenue): la salida emocional debe leerse y tocarse
  // tan dignamente como el CTA primario (uxui-specialist).
  ctaSecondary: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 34,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(244,236,222,0.24)',
  },
  ctaSecondaryText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
    opacity: 0.85,
  },
  pressed: { opacity: 0.6 },
})
