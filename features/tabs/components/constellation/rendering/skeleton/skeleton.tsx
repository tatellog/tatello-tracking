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
}: {
  star: Resolved
  idx: number
  total: number
  build: SharedValue<number>
}) {
  const startT = total === 0 ? 0 : (idx / total) * 0.45
  const props = useAnimatedProps(() => {
    'worklet'
    const localT = Math.max(0, Math.min(1, (build.value - startT) / 0.12))
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
}: {
  a: Resolved
  b: Resolved
  idx: number
  total: number
  build: SharedValue<number>
}) {
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  // Lines start appearing after most stars have already lit, so
  // the cascade reads "stars first, then we connect them".
  const startT = total === 0 ? 0.4 : 0.4 + (idx / total) * 0.5
  const props = useAnimatedProps(() => {
    'worklet'
    const localT = Math.max(0, Math.min(1, (build.value - startT) / 0.15))
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
}: {
  stars: readonly Resolved[]
  lines: readonly (readonly [number, number])[]
  transform: string
}) {
  // Ping-pong 0 ↔ 1 over 1.5 s each direction. During the forward
  // pass stars cascade in (one by one in index order) and lines
  // stroke between them once most stars are lit; during the
  // reverse the figure dissolves. Looks like the cosmos is being
  // plotted live, paused, wiped, plotted again — exactly the
  // "rendering" cue the canvas was missing as a flat dark frame.
  const build = useSharedValue(0)
  useEffect(() => {
    build.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    return () => cancelAnimation(build)
  }, [build])

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
              />
            )
          })}
          {stars.map((s, i) => (
            <SkeletonStar key={`sk-s-${i}`} star={s} idx={i} total={stars.length} build={build} />
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
