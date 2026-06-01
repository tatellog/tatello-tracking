import { useEffect } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { colors } from '@/theme'

// Polvo de luz — Genshin-style motes of oro that drift slowly upward and
// fade. No Lottie (this is the first screen the app paints; the JS cost
// of a player would slow first paint). Pure Reanimated + SVG, seeded so
// the field never reshuffles between renders.
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Mote = {
  x: number
  r: number
  baseOpacity: number
  startY: number
  rise: number
  delay: number
  dur: number
}

const MOTES: Mote[] = (() => {
  const arr: Mote[] = []
  let s = 770413
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 16; i += 1) {
    arr.push({
      x: rand() * SCREEN_W,
      r: 0.8 + rand() * 1.8,
      baseOpacity: 0.04 + rand() * 0.08, // 0.04–0.12
      startY: SCREEN_H * (0.45 + rand() * 0.55),
      rise: SCREEN_H * (0.25 + rand() * 0.25),
      delay: rand() * 6000,
      dur: 7000 + rand() * 6000, // 7–13s
    })
  }
  return arr
})()

function DustMote({ mote, reduceMotion }: { mote: Mote; reduceMotion: boolean }) {
  const t = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0
      return
    }
    t.value = withDelay(
      mote.delay,
      withRepeat(withTiming(1, { duration: mote.dur, easing: Easing.inOut(Easing.sin) }), -1, false),
    )
    return () => cancelAnimation(t)
  }, [mote, reduceMotion, t])

  const animatedProps = useAnimatedProps(() => {
    const y = mote.startY - mote.rise * t.value
    // Fade in over the first third, hold, fade out over the last third.
    const fade =
      t.value < 0.3
        ? t.value / 0.3
        : t.value > 0.7
          ? (1 - t.value) / 0.3
          : 1
    return {
      cy: reduceMotion ? mote.startY : y,
      opacity: mote.baseOpacity * (reduceMotion ? 1 : fade),
    }
  })

  return (
    <AnimatedCircle cx={mote.x} r={mote.r} fill={colors.oroLight} animatedProps={animatedProps} />
  )
}

/* Drop after SkyBackground, before content. Decorative only. */
export function LightDust() {
  const reduceMotion = useReducedMotion() ?? false

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H}>
        {MOTES.map((m, i) => (
          <DustMote key={i} mote={m} reduceMotion={reduceMotion} />
        ))}
      </Svg>
    </View>
  )
}
