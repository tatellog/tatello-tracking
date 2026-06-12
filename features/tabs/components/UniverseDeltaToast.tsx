import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { subscribeUniverseDelta } from '@/features/tabs/universe-delta-bus'
import { ATTRIBUTE_LABEL, type UniverseAttributeKey } from '@/features/tabs/universe-rewards'
import { tint, UNIVERSE_ACCENT, UNIVERSE_ICON_PATH } from '@/features/tabs/universe-visuals'
import { colors, typography } from '@/theme'

/*
 * El mini toast astral — la recompensa INMEDIATA del registro:
 * "✦ +13 Claridad", tintado del atributo, 1.5 s, haptic ligero. Los
 * cards de "Tu universo hoy" muestran el acumulado; esto muestra el
 * instante. Montado una vez en el tabs layout (funciona registres
 * desde donde registres); escucha el universe-delta-bus, cuya fuente
 * es el MISMO cálculo que pinta los cards — toast y card nunca se
 * contradicen.
 *
 * Taps seguidos del mismo atributo (vasos de agua, ±15 min de sueño)
 * ACUMULAN en el toast visible (+13 → +26) en vez de spamear; el
 * haptic suena solo al aparecer, no por acumulación. Pure fade
 * (reduced-motion safe), pointer-transparent, glifo estático — cero
 * riesgo de animación.
 */

const VISIBLE_MS = 1500

type Moment = {
  key: UniverseAttributeKey
  delta: number
  /** Cambia con cada acumulación — re-monta el número para que "pope". */
  seq: number
}

function AttributeGlyph({ attrKey, color }: { attrKey: UniverseAttributeKey; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d={UNIVERSE_ICON_PATH[attrKey]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function UniverseDeltaToast() {
  const [moment, setMoment] = useState<Moment | null>(null)
  // El haptic solo al APARECER el toast — visible.current evita que
  // cada vaso acumulado vuelva a vibrar encima del selection del tap.
  const visible = useRef(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = subscribeUniverseDelta(({ key, delta }) => {
      if (!visible.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      }
      visible.current = true
      setMoment((prev) =>
        prev && prev.key === key
          ? { key, delta: prev.delta + delta, seq: prev.seq + 1 }
          : { key, delta, seq: 0 },
      )
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        visible.current = false
        setMoment(null)
      }, VISIBLE_MS)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!moment) return null
  const accent = UNIVERSE_ACCENT[moment.key]
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        entering={FadeIn.duration(240)}
        exiting={FadeOut.duration(220)}
        style={[styles.toast, { borderColor: tint(accent, '59') }]}
      >
        <AttributeGlyph attrKey={moment.key} color={accent} />
        {/* key=seq re-monta el número en cada acumulación — un pop de
            120 ms, suficiente para sentir que el tap sumó. */}
        <Animated.Text
          key={moment.seq}
          entering={FadeIn.duration(120)}
          style={[styles.delta, { color: accent }]}
        >
          +{moment.delta}
        </Animated.Text>
        <Text style={styles.label}>{ATTRIBUTE_LABEL[moment.key]}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Sits above the tab bar, centered. Pointer-transparent so it never
  // blocks a tap.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 112,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  delta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
})
