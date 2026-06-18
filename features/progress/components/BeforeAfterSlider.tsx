import { useEffect, useMemo } from 'react'
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/*
 * BeforeAfterSlider — el "modo comparar": una sola imagen grande con un divisor
 * que se arrastra para revelar ANTES (izquierda) sobre AHORA (fondo). El gesto
 * es horizontal; `activeOffsetX` deja pasar el scroll vertical de la pantalla.
 * Ambas fotos en `cover` para que llenen el mismo marco y el reveal alinee.
 */
export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
}: {
  beforeUrl: string
  afterUrl: string
}) {
  const { width: screenW } = useWindowDimensions()
  const W = screenW - 40 // padding del contenido (20 por lado)
  const H = Math.round(W * 1.25) // retrato 4:5 — grande, no miniatura

  const x = useSharedValue(W / 2)
  // Ancho como shared value para clampear en el worklet sin recrear el gesto.
  const wSv = useSharedValue(W)
  useEffect(() => {
    wSv.value = W
  }, [W, wSv])

  // Gesto memoizado (identidad estable): un re-render del padre —p.ej. un
  // refetch de React Query mientras arrastras— no debe resetear el gesto.
  // failOffsetY libera el ScrollView vertical si la mano se desvía.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onChange((e) => {
          const next = x.value + e.changeX
          x.value = next < 0 ? 0 : next > wSv.value ? wSv.value : next
        }),
    [x, wSv],
  )

  const clipStyle = useAnimatedStyle(() => ({ width: x.value }))
  const handleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 1 }] }))
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - 18 }] }))

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.frame, { width: W, height: H }]}>
        {/* Fondo: AHORA (se revela a la derecha del divisor). */}
        <Image
          source={{ uri: afterUrl }}
          style={[styles.img, { width: W, height: H }]}
          resizeMode="cover"
        />

        {/* Encima: ANTES, recortado a la izquierda del divisor. */}
        <Animated.View style={[styles.clip, { height: H }, clipStyle]}>
          <Image
            source={{ uri: beforeUrl }}
            style={[styles.img, { width: W, height: H }]}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Etiquetas */}
        <View style={styles.tagAntes} pointerEvents="none">
          <Text style={styles.tagText}>Antes</Text>
        </View>
        <View style={styles.tagAhora} pointerEvents="none">
          <Text style={styles.tagText}>Ahora</Text>
        </View>

        {/* Divisor + asa */}
        <Animated.View style={[styles.divider, { height: H }, handleStyle]} pointerEvents="none" />
        <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
          <Text style={styles.knobGlyph}>‹ ›</Text>
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard2,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  img: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  divider: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 2,
    backgroundColor: colors.leche,
    opacity: 0.9,
  },
  knob: {
    position: 'absolute',
    top: '50%',
    left: 0,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.leche,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobGlyph: {
    fontFamily: typography.uiBold,
    fontSize: 14,
    letterSpacing: 1,
    color: colors.leche,
  },
  tagAntes: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.scrim,
  },
  tagAhora: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.scrim,
  },
  tagText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.leche,
  },
})
