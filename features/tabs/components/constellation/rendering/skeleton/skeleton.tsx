import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { G } from 'react-native-svg'

import { BlurView } from 'expo-blur'

import { colors } from '@/theme'

import { AnimatedCircle, AnimatedLine } from '../../animation/animated-components'
import { H, W } from '../../constants'
import type { Resolved } from '../../types'

/*
 * Skeleton shown for the brief window between mount and the moment
 * the nested zodiac-art <Svg> has settled its size. Draws the
 * user's actual sign constellation as if it were being plotted:
 * stars ignite one by one in index order, then the connecting
 * lines stroke in between them. Ping-pongs forever so a slow
 * device sees the build → dissolve → rebuild loop instead of a
 * frozen frame.
 *
 * BlurView over the whole thing reads as "not yet in focus" —
 * when the real Svg fades in, the silhouette is exactly where it
 * was being drawn, so the eye perceives the constellation
 * snapping into focus rather than swapping in.
 */
function SkeletonStar({
  star,
  idx,
  total,
  build,
  reduce,
}: {
  star: Resolved
  idx: number
  total: number
  build: SharedValue<number>
  /** When ON, `build` is parked at 1 but the per-element ramp would
   *  still leave the last-cascading stars short of full opacity. We
   *  clamp localT = 1 so every star rests fully drawn. Constant prop
   *  captured as a worklet closure scalar. */
  reduce: boolean
}) {
  const startT = total === 0 ? 0 : (idx / total) * 0.45
  const props = useAnimatedProps(() => {
    'worklet'
    const localT = reduce ? 1 : Math.max(0, Math.min(1, (build.value - startT) / 0.12))
    return { opacity: localT * 0.7 }
  })
  return (
    <AnimatedCircle
      cx={star.x}
      cy={star.y}
      r={Math.max(2.4, 5.4 - (star.mag - 1) * 0.55)}
      fill={colors.leche}
      animatedProps={props}
    />
  )
}

function SkeletonLine({
  a,
  b,
  idx,
  total,
  build,
  reduce,
}: {
  a: Resolved
  b: Resolved
  idx: number
  total: number
  build: SharedValue<number>
  /** When ON, `build` is parked at 1 but the later lines (startT≈0.9)
   *  would only reach localT≈0.66, resting half-stroked / dim. We clamp
   *  localT = 1 so every line rests fully stroked + opaque. Constant
   *  prop captured as a worklet closure scalar. */
  reduce: boolean
}) {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  // Lines start appearing after most stars have already lit, so
  // the cascade reads "stars first, then we connect them".
  const startT = total === 0 ? 0.4 : 0.4 + (idx / total) * 0.5
  const props = useAnimatedProps(() => {
    'worklet'
    const localT = reduce ? 1 : Math.max(0, Math.min(1, (build.value - startT) / 0.15))
    return {
      strokeDashoffset: length * (1 - localT),
      opacity: localT * 0.6,
    }
  })
  return (
    <AnimatedLine
      x1={a.x}
      y1={a.y}
      x2={b.x}
      y2={b.y}
      stroke={colors.leche}
      strokeWidth={1}
      strokeLinecap="round"
      strokeDasharray={`${length} ${length}`}
      animatedProps={props}
    />
  )
}

export function CanvasSkeleton({
  stars,
  lines,
  transform,
  reduce,
}: {
  stars: readonly Resolved[]
  lines: readonly (readonly [number, number])[]
  // Array form (RN transform spec) — string SVG transforms crash
  // RNSVGGroupManagerDelegate on Fabric Android with a
  // ClassCastException (String vs ReadableArray). Each element is a
  // single-property object like `{ translateX: 56 }` or `{ scaleY: 0.68 }`.
  transform: any[]
  /** iOS "Reducir movimiento". When ON the build ping-pong never
   *  starts — `build` is parked at 1 AND each SkeletonStar/Line clamps
   *  its own localT to 1, so the skeleton shows the figure FULLY DRAWN
   *  (all stars + lines fully stroked at their final opacity): a
   *  legible static placeholder instead of a looping plot. */
  reduce: boolean
}) {
  // Ping-pong 0 ↔ 1 over 1.5 s each direction. During the forward
  // pass stars cascade in (one by one in index order) and lines
  // stroke between them once most stars are lit; during the
  // reverse the figure dissolves. Looks like the cosmos is being
  // plotted live, paused, wiped, plotted again — exactly the
  // "rendering" cue the canvas was missing as a flat dark frame.
  const build = useSharedValue(0)
  useEffect(() => {
    if (reduce) {
      // Park fully drawn. The per-element clamp (localT = 1) does the
      // real work — parking build at 1 alone leaves late-cascade lines
      // (startT≈0.9) short — so we park here and clamp there.
      build.value = 1
      return () => cancelAnimation(build)
    }
    build.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    return () => cancelAnimation(build)
  }, [build, reduce])

  return (
    <View style={styles.canvasSkeleton}>
      <Svg viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
        <G transform={transform}>
          {lines.map(([aIdx, bIdx], i) => {
            const a = stars[aIdx]
            const b = stars[bIdx]
            if (!a || !b) return null
            return (
              <SkeletonLine
                key={`sk-l-${i}`}
                a={a}
                b={b}
                idx={i}
                total={lines.length}
                build={build}
                reduce={reduce}
              />
            )
          })}
          {stars.map((s, i) => (
            <SkeletonStar
              key={`sk-s-${i}`}
              star={s}
              idx={i}
              total={stars.length}
              build={build}
              reduce={reduce}
            />
          ))}
        </G>
      </Svg>
      <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  )
}

const styles = StyleSheet.create({
  // Static placeholder that fills the canvas frame while the SVG's
  // nested zodiac-art image settles its size (~2 RAFs). Same bg as
  // the screen so only the bronze hairline border reads during the
  // hold; the 260 ms FadeIn on the real composition that follows is
  // what carries the reveal.
  canvasSkeleton: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
})
