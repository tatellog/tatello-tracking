import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors } from '@/theme'

// ── The app's sky ───────────────────────────────────────────────────
// One starfield + nebula behind every tab — the single celestial
// motif. Fixed (it doesn't scroll); content drifts over a still sky.
// Three brightness tiers; the bright tier twinkles. Seeded so it never
// reshuffles.
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Star = {
  x: number
  y: number
  r: number
  o: number
  twinkle: boolean
  delay: number
  dur: number
}

const SCREEN_STARS: Star[] = (() => {
  const arr: Star[] = []
  let s = 20260516
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  for (let i = 0; i < 108; i += 1) {
    const b = rand()
    const bright = b > 0.9
    const mid = !bright && b > 0.62
    arr.push({
      x: rand() * SCREEN_W,
      y: rand() * SCREEN_H,
      r: bright ? 1.6 + rand() * 0.9 : mid ? 1 + rand() * 0.7 : 0.5 + rand() * 0.8,
      o: bright ? 0.34 + rand() * 0.16 : mid ? 0.2 + rand() * 0.14 : 0.07 + rand() * 0.13,
      twinkle: bright,
      delay: rand() * 2800,
      dur: 1900 + rand() * 1900,
    })
  }
  return arr
})()

/* A bright star that breathes — slow, desynced, so the sky reads as
 * alive rather than printed.
 *
 * The twinkle loop is GATED on `active` (screen focused + not mid-scroll).
 * This starfield <Svg> is mounted behind EVERY tab, and any animated SVG
 * child repaints the whole 108-node <Svg> 60×/s on Android — so an ungated
 * loop taxed the UI thread app-wide, forever, even off-tab and during every
 * scroll. While inactive the star eases to a still rest brightness (no blink,
 * no SVG repaint); when active it resumes its breath exactly as before — so
 * it looks identical whenever you're actually looking at it. */
function TwinkleStar({ star, active }: { star: Star; active: boolean }) {
  // Rest at the breath's mid-point so a paused star sits at a natural,
  // non-blinking brightness rather than its trough.
  const tw = useSharedValue(0.5)
  useEffect(() => {
    if (!active) {
      cancelAnimation(tw)
      tw.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.quad) })
      return
    }
    tw.value = withDelay(
      star.delay,
      withRepeat(withTiming(1, { duration: star.dur, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(tw)
  }, [star, tw, active])

  const animatedProps = useAnimatedProps(() => ({
    opacity: star.o * (0.42 + tw.value * 0.72),
  }))

  return (
    <AnimatedCircle
      cx={star.x}
      cy={star.y}
      r={star.r}
      fill={colors.leche}
      animatedProps={animatedProps}
    />
  )
}

/*
 * The shared celestial backdrop. Drop it as the first child of a
 * screen's (opaque-bg) root View; keep the content tree transparent
 * so the sky shows through.
 */
export function SkyBackground() {
  // Pauses the twinkle when the host screen is off-tab or mid-scroll (see
  // TwinkleStar). Where no ScrollPauseContext is provided (settings, auth,
  // …) this is simply focus-gating — the loop stops when you leave the tab.
  const active = useScreenActive()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* A soft magenta haze at the top — atmospheric depth. Low start
          opacity + a tall, gradual fade so it never reads as a hard band
          where it meets the darker page. */}
      <LinearGradient colors={[colors.magentaTint, 'transparent']} style={styles.nebula} />
      <Svg style={styles.starfield} width={SCREEN_W} height={SCREEN_H}>
        {SCREEN_STARS.map((st, i) =>
          st.twinkle ? (
            <TwinkleStar key={i} star={st} active={active} />
          ) : (
            <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill={colors.leche} opacity={st.o} />
          ),
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  nebula: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.75,
  },
  starfield: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
})
