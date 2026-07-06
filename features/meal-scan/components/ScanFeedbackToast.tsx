import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { subscribeScanFeedback, type ScanFeedbackPayload } from '@/features/meal-scan/feedback-bus'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

/*
 * El toast "¿le atiné?" (M1) — montado GLOBAL en el (tabs) layout: el scan
 * emite al guardar y navega de vuelta; el toast recibe a la usuaria al
 * aterrizar. Un tap en "Sí" registra el acierto; "Ajustar" reabre la
 * comida recién creada Y registra el fallo. Ambos alimentan
 * `scan_feedback` con la confianza que el modelo declaró — el dato que
 * mide si el scan es de verdad excepcional (M1) y si la confianza
 * declarada predice los errores reales.
 *
 * Ventana generosa (8 s): el emit ocurre bajo la pantalla del scan y el
 * reveal (~2.5 s) consume el inicio. Ignorarlo también es respuesta: al
 * expirar se registra scan_feedback {answered: false}.
 */

const VISIBLE_MS = 8000

export function ScanFeedbackToast() {
  const router = useRouter()
  const [payload, setPayload] = useState<ScanFeedbackPayload | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = subscribeScanFeedback((p) => {
      setPayload(p)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        setPayload(null)
        track('scan_feedback', { answered: false, confidence: p.confidence })
      }, VISIBLE_MS)
    })
    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  if (!payload) return null

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current)
    setPayload(null)
  }

  const onYes = () => {
    track('scan_feedback', { answered: true, accurate: true, confidence: payload.confidence })
    dismiss()
  }

  const onAdjust = () => {
    track('scan_feedback', { answered: true, accurate: false, confidence: payload.confidence })
    const id = payload.id
    dismiss()
    router.push({ pathname: '/scan-meal', params: { editId: id } })
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={1}>
          ¿Le atinamos a <Text style={styles.name}>{payload.name}</Text>?
        </Text>
        <Pressable
          onPress={onYes}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sí, la lectura fue correcta"
          style={styles.btn}
        >
          <Text style={styles.btnYes}>Sí</Text>
        </Pressable>
        <Pressable
          onPress={onAdjust}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Ajustar ${payload.name}`}
          style={styles.btn}
        >
          <Text style={styles.btnAdjust}>Ajustar</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 118,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  text: {
    flexShrink: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  name: {
    fontFamily: typography.uiSemi,
    color: colors.leche,
  },
  btn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  btnYes: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.oroLight,
  },
  btnAdjust: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magentaHot,
  },
})
