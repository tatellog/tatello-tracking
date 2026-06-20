import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { UNIVERSE_ACCENT, tint } from '@/features/tabs/universe-visuals'
import { colors, typography } from '@/theme'

import { formatGlasses, glassesWord } from '../liquid-detection'

/*
 * Confirmación flotante tras aceptar líquidos de una comida: "✦ +1 vaso
 * desde comidas", ~2 s. Cierra el lazo "Stelar entendió lo que tomé". Pure
 * fade (reduced-motion safe), pointer-transparente.
 *
 * `glasses` > 0 dispara una aparición; `seq` permite re-disparar con el
 * mismo valor. Vive sobre la pantalla del reveal (el toast global queda
 * detrás de esa ruta full-screen).
 */

const WATER = UNIVERSE_ACCENT.claridad
const VISIBLE_MS = 2000

export function WaterFromMealsToast({ glasses, seq }: { glasses: number; seq: number }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (glasses <= 0) return
    setShown(true)
    const id = setTimeout(() => setShown(false), VISIBLE_MS)
    return () => clearTimeout(id)
  }, [glasses, seq])

  return (
    <View style={styles.wrap} pointerEvents="none">
      {shown && glasses > 0 ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(200)}
          style={[styles.toast, { borderColor: tint(WATER, '80'), shadowColor: WATER }]}
        >
          <Text style={[styles.spark, { color: WATER }]}>✦</Text>
          <Text style={styles.text}>
            +{formatGlasses(glasses)} {glassesWord(glasses)} desde comidas
          </Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.bgCard2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  spark: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
  },
  text: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
})
