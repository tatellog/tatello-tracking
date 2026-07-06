import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { useDeleteMeal } from '@/features/macros/hooks'
import { subscribeMealUndo, type MealUndoPayload } from '@/features/tabs/undo-meal-bus'
import { colors, typography } from '@/theme'

/*
 * El snackbar de deshacer tras un re-log de 1 tap — montado GLOBAL en el
 * (tabs) layout (el QuickLog se cierra solo tras el tap; el undo debe
 * sobrevivirlo). "«Sopa» sumada a Desayuno · Deshacer", ~5 s, sin culpa:
 * deshacer es corregir un dedo, no un fallo. El delete reusa
 * useDeleteMeal (optimista: el brief y las señales se ajustan solos).
 *
 * Convive con el UniverseDeltaToast (bottom 112): este vive un poco más
 * abajo para no encimarse; si ambos aparecen, cuentan cosas distintas
 * (recompensa vs corrección) y se toleran.
 */

const VISIBLE_MS = 5000

export function UndoMealToast() {
  const [payload, setPayload] = useState<MealUndoPayload | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteMeal = useDeleteMeal()

  useEffect(() => {
    const unsub = subscribeMealUndo((p) => {
      setPayload(p)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setPayload(null), VISIBLE_MS)
    })
    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  if (!payload) return null

  const undo = () => {
    deleteMeal.mutate(payload.id)
    if (timer.current) clearTimeout(timer.current)
    setPayload(null)
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
          <Text style={styles.name}>{payload.name}</Text> sumada a {payload.mealTypeLabel}
        </Text>
        <Pressable
          onPress={undo}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Deshacer: quitar ${payload.name}`}
          style={styles.undoBtn}
        >
          <Text style={styles.undoText}>Deshacer</Text>
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
    gap: 12,
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
  undoBtn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  undoText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magentaHot,
  },
})
