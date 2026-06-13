import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
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
//
// PERFORMANCE (este fondo vive en ~21 pantallas, así que su costo es
// app-wide):
//   - Las estrellas ESTÁTICAS viven en UN solo <Svg>. Sin hijos animados,
//     RNSVG lo rasteriza UNA vez y no lo vuelve a tocar.
//   - Las que respiran NO van en ese <Svg>: van como Animated.View (un
//     punto con borderRadius) cuya OPACIDAD se anima — propiedad de
//     compositor (GPU), sin re-rasterizar nada. Antes eran AnimatedCircle
//     dentro del <Svg> de 108 nodos, y cualquier hijo animado obligaba a
//     RNSVG a repintar los 108 nodos 60×/s (sobre todo en Android) — un
//     impuesto perpetuo en cada pantalla. Ahora el SVG es estático y solo
//     ~11 opacidades de View se actualizan en el UI thread: prácticamente
//     gratis. El twinkle sigue gateado en foco (pausa fuera de tab/scroll).
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

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

// Split ONCE at module load: the still field (one static <Svg>) vs the
// breathing stars (compositor-only Animated.View dots).
const STATIC_STARS = SCREEN_STARS.filter((st) => !st.twinkle)
const TWINKLE_STARS = SCREEN_STARS.filter((st) => st.twinkle)

/* A bright star that breathes — slow, desynced, so the sky reads as alive
 * rather than printed. Renders as a plain View (a tiny round dot), NOT an
 * SVG node: animating its opacity is a compositor op on the UI thread, so
 * it never forces the static starfield <Svg> to re-rasterize.
 *
 * The twinkle loop is GATED on `active` (screen focused + not mid-scroll):
 * while inactive the dot eases to a still rest brightness and the loop is
 * cancelled (zero work off-tab / mid-scroll); when active it resumes its
 * breath exactly as before — identical whenever you're actually looking. */
function TwinkleDot({ star, active }: { star: Star; active: boolean }) {
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

  const style = useAnimatedStyle(() => ({
    opacity: star.o * (0.42 + tw.value * 0.72),
  }))

  const d = star.r * 2
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: star.x - star.r,
          top: star.y - star.r,
          width: d,
          height: d,
          borderRadius: star.r,
          backgroundColor: colors.leche,
        },
        style,
      ]}
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
  // TwinkleDot). Where no ScrollPauseContext is provided (settings, auth,
  // …) this is simply focus-gating — the loop stops when you leave the tab.
  const active = useScreenActive()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* A soft magenta haze at the top — atmospheric depth. Low start
          opacity + a tall, gradual fade so it never reads as a hard band
          where it meets the darker page. */}
      <LinearGradient colors={[colors.magentaTint, 'transparent']} style={styles.nebula} />
      {/* STATIC field — one <Svg>, rasterized once, no per-frame repaint. */}
      <Svg style={styles.starfield} width={SCREEN_W} height={SCREEN_H}>
        {STATIC_STARS.map((st, i) => (
          <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill={colors.leche} opacity={st.o} />
        ))}
      </Svg>
      {/* Breathing stars — compositor-only opacity, outside the <Svg>. */}
      {TWINKLE_STARS.map((st, i) => (
        <TwinkleDot key={i} star={st} active={active} />
      ))}
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
