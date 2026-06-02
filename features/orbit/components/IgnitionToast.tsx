import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { subscribeIgnition } from '../ignitionBus'
import { type DimensionKey } from '../logic'

/*
 * The celestial toast that closes the register→read loop without leaving
 * the screen: log something → a brief "se encendió algo en tu cielo".
 * Mounted once in the tabs layout; listens to the ignition bus. Pure fade
 * (reduced-motion safe), auto-dismiss, pointer-transparent. The glyph is
 * static — no Reanimated worklet — so this carries zero animation risk.
 */
const PHRASE: Partial<Record<DimensionKey, string>> = {
  alimento: 'Otra estrella en tu cielo',
  sueno: 'Encendiste tu sueño en tu cielo',
  energia: 'Encendiste tu energía en tu cielo',
  mente: 'Encendiste tu mente en tu cielo',
  cuerpo: 'Encendiste tu cuerpo en tu cielo',
}
const DEFAULT_PHRASE = 'Otra estrella en tu cielo'
const VISIBLE_MS = 1800

function SparkIgnite({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={colors.oro} opacity={0.18} />
      <Path
        d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
        fill={colors.oro}
      />
      <Circle cx={12} cy={12} r={2} fill={colors.oroLeche} />
    </Svg>
  )
}

export function IgnitionToast() {
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = subscribeIgnition((key) => {
      setMsg(PHRASE[key] ?? DEFAULT_PHRASE)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), VISIBLE_MS)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!msg) return null
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        entering={FadeIn.duration(320)}
        exiting={FadeOut.duration(260)}
        style={styles.toast}
      >
        <SparkIgnite />
        <Text style={styles.text}>{msg}</Text>
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
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.bgCard,
  },
  text: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
})
