import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
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
  /** El umbral cruzado (25/50/75/100) — el emblema se muestra a ese %. */
  threshold: number
  /** Copy de la etapa (voz del coach), provisto por el orquestador. */
  message: string
  onClose: () => void
}

export function TransformationReveal({ sign, threshold, message, onClose }: Props) {
  const { width, height } = useWindowDimensions()
  const reduced = useReducedMotion() ?? false
  const router = useRouter()

  const emblemSize = Math.min(width - 96, 300)

  const enter = useSharedValue(0)
  const emblem = useSharedValue(0)

  useEffect(() => {
    if (reduced) {
      enter.value = withTiming(1, { duration: 320 })
      emblem.value = withTiming(1, { duration: 360 })
    } else {
      enter.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })
      emblem.value = withDelay(
        240,
        withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
      )
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }
  }, [reduced, enter, emblem])

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
          <Animated.View style={[styles.card, { width: Math.min(width - 56, 360) }, cardStyle]}>
            <Text style={styles.eyebrow}>TU TRANSFORMACIÓN</Text>
            <Text style={styles.threshold}>{threshold}%</Text>

            <Animated.View style={[styles.emblemWrap, emblemStyle]} pointerEvents="none">
              <RevealedEmblem sign={sign} transformProgress={threshold} size={emblemSize} />
            </Animated.View>

            <Animated.Text
              entering={FadeIn.duration(420).delay(reduced ? 200 : 900)}
              style={styles.message}
            >
              {message}
            </Animated.Text>

            <Animated.View
              entering={FadeIn.duration(360).delay(reduced ? 300 : 1200)}
              style={styles.ctaWrap}
            >
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
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Pressable>
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
  threshold: {
    fontFamily: typography.uiSemi,
    fontSize: 13,
    color: colors.niebla,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  emblemWrap: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  ctaSecondary: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  ctaSecondaryText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  pressed: { opacity: 0.6 },
})
