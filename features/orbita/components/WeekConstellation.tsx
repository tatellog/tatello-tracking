import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, type ViewStyle, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { DiaSemana } from '../mock'

const WEEK_ART_PNG = require('@/assets/orbits-art/orbit-week-art.png')

/*
 * The Semana hero — the week rendered as a spiral galaxy centred
 * on `orbit-week-art.png`. Each day sits on a painted halo node;
 * tapping a halo opens a `HaloBubble` with the day's archetype +
 * voice phrase, and (today only) an "Abrir Día" CTA.
 *
 * Helper components are defined ABOVE the main `WeekConstellation`
 * export. Reanimated's Babel plugin transforms components that use
 * `useAnimatedProps`; that transform has interacted badly with
 * function-declaration hoisting in our setup, so we keep the
 * helpers first as a durable fix.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const HIT = 56

// Static day positions — anchored to the painted orbital nodes in
// `orbit-week-art.png`. Days walk clockwise from the top so Sunday
// lands on the first painted halo and the week ends at upper-left.
const DAY_POS: readonly { x: number; y: number }[] = [
  { x: 186, y: 56 }, // top
  { x: 298, y: 112 }, // upper-right
  { x: 335, y: 205 }, // right
  { x: 261, y: 298 }, // lower-right
  { x: 186, y: 335 }, // bottom
  { x: 93, y: 280 }, // lower-left
  { x: 56, y: 130 }, // upper-left
]

// Short day labels (3 letters) shown ABOVE each halo, and the
// initial(s) shown INSIDE the halo. Tuesday/Wednesday use 2-letter
// initials ("Ma"/"Mi") because a single "M" would collide between
// MAR and MIE — the inner emblem must uniquely identify the day.
const DAY_LABELS: readonly string[] = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB']
const DAY_LETTERS: readonly string[] = ['D', 'L', 'Ma', 'Mi', 'J', 'V', 'S']

// Orbital ellipses — overlapping dashed paths at different
// inclinations + radii. Suggests a 3D orbital web (the painted PNG
// has its own ring, these add programmatic layers + motion on top).
const ORBIT_ELLIPSES: readonly {
  rx: number
  ry: number
  rotation: number
  strokeWidth: number
  dash: string
  opacity: number
}[] = [
  { rx: 145, ry: 138, rotation: 0, strokeWidth: 0.6, dash: '1.5 5', opacity: 0.55 },
  { rx: 152, ry: 122, rotation: 18, strokeWidth: 0.5, dash: '1 6', opacity: 0.42 },
  { rx: 138, ry: 148, rotation: -20, strokeWidth: 0.5, dash: '1.2 5', opacity: 0.45 },
  { rx: 158, ry: 110, rotation: 38, strokeWidth: 0.45, dash: '1 7', opacity: 0.35 },
  { rx: 122, ry: 152, rotation: -42, strokeWidth: 0.45, dash: '0.8 6', opacity: 0.32 },
]

// Inner orbital ellipses around the galactic bulge — cream stroke
// (magenta-on-pink vanished on the bright nucleus), pushed outward
// off the brightest pixels so they read instead of washing out.
const CENTER_ELLIPSES: readonly {
  rx: number
  ry: number
  rotation: number
  strokeWidth: number
  dash: string
  opacity: number
}[] = [
  { rx: 80, ry: 66, rotation: 12, strokeWidth: 0.5, dash: '1.5 4', opacity: 0.7 },
  { rx: 58, ry: 46, rotation: 55, strokeWidth: 0.4, dash: '1 4', opacity: 0.55 },
]

// Depth dust — sparse cream specks scattered between the galaxy
// and the orbital ring. Adds parallax + "system" feel beyond the
// painted galaxy + day halos.
const WEEK_DUST: readonly {
  initialAngle: number
  radius: number
  speed: number
  r: number
  op: number
  phase: number
}[] = Array.from({ length: 60 }, (_, i) => {
  const angBase = (i * 360) / 60
  const angJitter = (((i * 73) % 31) - 15) * 0.6
  const radius = 50 + ((i * 19) % 110)
  const depth = ((i * 53) % 100) / 100
  return {
    initialAngle: angBase + angJitter,
    radius,
    speed: -100 / radius,
    r: 0.4 + depth * 1.4,
    op: 0.14 + depth * 0.45,
    phase: (i % 11) / 11,
  }
})

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/* A single dust mote that orbits the nucleus along an inverse-
 * radius angular speed (inner motes outpace outer ones, forming
 * shifting spiral arms). */
function WeekDustMote({
  mote,
  spin,
  t,
}: {
  mote: (typeof WEEK_DUST)[number]
  spin: SharedValue<number>
  t: SharedValue<number>
}) {
  const animated = useAnimatedProps(() => {
    'worklet'
    const angle = ((mote.initialAngle + spin.value * 360 * mote.speed) * Math.PI) / 180
    const cx = CX + Math.cos(angle) * mote.radius
    const cy = CY + Math.sin(angle) * mote.radius
    const wave = 0.5 + 0.5 * Math.sin((t.value + mote.phase) * 2 * Math.PI)
    return { cx, cy, opacity: mote.op * (0.5 + 0.5 * wave) }
  })
  return <AnimatedCircle r={mote.r} fill="#FBD7E3" animatedProps={animated} />
}

/* A lived day — a luminous magenta body anchored to its position.
 * Today gets a significantly larger body, a permanent halo ring,
 * and (via the sibling `TodayPulseRing`) an expanding pulse that
 * signals "tap me" from across the canvas. */
function DayBody({
  day,
  pos,
  isToday,
  t,
  popT,
  selected,
  faded,
  phase,
}: {
  day: DiaSemana
  pos: { x: number; y: number }
  isToday: boolean
  t: SharedValue<number>
  popT: SharedValue<number>
  selected: boolean
  faded: boolean
  phase: number
}) {
  const { x, y } = pos
  const b = day.brightness
  // Today is the hero — body grows from 4.2 → 6.2 base so the
  // luminance gap with past days is unmistakable.
  const R = (isToday ? 6.2 : 3) + b * 2.4
  const bloomR = R * 3.4
  const auraR = R * 1.9

  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * (isToday ? 0.09 : 0.04)
    if (selected) scale *= 1 + popT.value * 0.4
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
        { translateX: -x },
        { translateY: -y },
      ],
    }
  })

  return (
    // Faded (= a different day is selected): drop to 30 % so the
    // selected halo is unambiguously the focus.
    <G opacity={faded ? 0.3 : 1}>
      <AnimatedG animatedProps={breath}>
        <Circle cx={x} cy={y} r={bloomR} fill={colors.magenta} opacity={0.08 + b * 0.12} />
        <Circle cx={x} cy={y} r={auraR} fill="#FBD7E3" opacity={0.1 + b * 0.16} />
        {/* Permanent halo ring on HOY so it reads as the anchor
            even before the user taps. */}
        {isToday ? (
          <Circle
            cx={x}
            cy={y}
            r={R + 4}
            fill="none"
            stroke={colors.magentaHot}
            strokeWidth={1.1}
            opacity={0.85}
          />
        ) : null}
        {selected ? (
          <Circle
            cx={x}
            cy={y}
            r={R + 6}
            fill="none"
            stroke="#F4ECDE"
            strokeWidth={1.3}
            opacity={0.9}
          />
        ) : null}
        <Circle cx={x} cy={y} r={R} fill="url(#weekBody)" />
        <Circle cx={x} cy={y} r={R * 0.45} fill="#FFFFFF" opacity={0.9} />
      </AnimatedG>
    </G>
  )
}

/* A day that hasn't arrived — rendered as a thin DASHED RING
 * instead of a filled body. `proximity` opens the tomorrow ghost
 * more brightly and whispers the far end of the week down toward
 * invisibility. */
function DayGhost({
  pos,
  proximity,
  selected,
  faded,
}: {
  pos: { x: number; y: number }
  /** 1 = tomorrow, larger = farther into the week. */
  proximity: number
  selected: boolean
  faded: boolean
}) {
  const { x, y } = pos
  const proxFactor = Math.max(0.35, 1 - (proximity - 1) * 0.22)
  const R = 3.2
  // Future days must read as visibly QUIETER than past days from
  // across the canvas.
  const wrapOpacity = (faded ? 0.35 : 1) * (0.22 + proxFactor * 0.16)
  return (
    <G opacity={wrapOpacity}>
      <Circle
        cx={x}
        cy={y}
        r={R}
        fill="none"
        stroke="#F4ECDE"
        strokeWidth={0.7}
        strokeDasharray="1.2 2.2"
        strokeLinecap="round"
        opacity={0.75 + proxFactor * 0.2}
      />
      <Circle cx={x} cy={y} r={0.9} fill="#F4ECDE" opacity={0.55 + proxFactor * 0.35} />
      {selected ? (
        <Circle
          cx={x}
          cy={y}
          r={R + 4}
          fill="none"
          stroke="#F4ECDE"
          strokeWidth={0.9}
          opacity={0.85}
        />
      ) : null}
    </G>
  )
}

/* The tap-affordance ring on HOY — a thin cream circle that
 * expands and fades on a 1.5 s loop. */
function TodayPulseRing({
  pos,
  pulse,
  bodyR,
}: {
  pos: { x: number; y: number }
  pulse: SharedValue<number>
  bodyR: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const r = bodyR + 3 + pulse.value * 13
    const opacity = (1 - pulse.value) * 0.55
    return { r, opacity }
  })
  return (
    <AnimatedCircle
      cx={pos.x}
      cy={pos.y}
      fill="none"
      stroke="#F4ECDE"
      strokeWidth={0.9}
      animatedProps={animatedProps}
    />
  )
}

/* The tap ripple — a one-shot expanding magenta ring that bursts
 * out from a halo on every tap. Distinct from the persistent
 * TodayPulseRing (which loops on HOY): this fires exactly once per
 * interaction, giving each tap a tactile "you hit it" cue before
 * the bubble appears. Keyed by tapCount in the parent so it
 * re-mounts on every tap, even when the user re-taps the same
 * halo. */
function HaloTapRipple({ pos }: { pos: { x: number; y: number } }) {
  const wave = useSharedValue(0)
  useEffect(() => {
    wave.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(wave)
  }, [wave])

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    // Ring expands from 8 → 36 px and fades 0.7 → 0 over its life.
    return {
      r: 8 + wave.value * 28,
      opacity: (1 - wave.value) * 0.7,
    }
  })

  return (
    <AnimatedCircle
      cx={pos.x}
      cy={pos.y}
      fill="none"
      stroke={colors.magentaHot}
      strokeWidth={1.2}
      animatedProps={animatedProps}
    />
  )
}

/* Custom entrance animation for the bubble — scale 0.86 → 1 with
 * a gentle spring overshoot, opacity 0 → 1 over 240 ms. Reads as
 * "the day is speaking now" without the abrupt pop a pure FadeIn
 * gives. */
function bubbleEntering() {
  'worklet'
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scale: 0.86 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
      transform: [{ scale: withSpring(1, { damping: 14, stiffness: 220, mass: 0.7 }) }],
    },
  }
}

/* Custom exit animation — scale 1 → 0.92 + fade out over 160 ms.
 * Slightly faster than the entrance so the bubble vacates briskly
 * when the user moves on. */
function bubbleExiting() {
  'worklet'
  return {
    initialValues: {
      opacity: 1,
      transform: [{ scale: 1 }],
    },
    animations: {
      opacity: withTiming(0, { duration: 160 }),
      transform: [{ scale: withTiming(0.92, { duration: 160 }) }],
    },
  }
}

/* The halo-anchored info bubble — a small floating callout that
 * materialises next to the tapped halo, points back at it with a
 * triangular arrow, and contains the day's name + voice phrase +
 * (for today) the "Abrir Día" CTA. Replaces the old bottom DayCard:
 * the constellation IS the UI now — each star carries its own info
 * right where the user's eye lands. */
function HaloBubble({
  pos,
  day,
  isToday,
  onOpenDia,
}: {
  pos: { x: number; y: number }
  day: DiaSemana
  isToday: boolean
  onOpenDia: () => void
}) {
  // Decide which side of the halo the bubble appears on. The rule:
  // place the bubble toward the side of the canvas with more room.
  // Halos near the top/bottom edge get a vertical placement
  // (below/above); halos in the middle band fall to the side
  // opposite the canvas centre so the bubble flows inward and
  // never falls off the screen.
  let direction: 'left' | 'right' | 'below' | 'above'
  if (pos.y < 90) direction = 'below'
  else if (pos.y > 280) direction = 'above'
  else if (pos.x > CX) direction = 'left'
  else direction = 'right'

  let offsetMargin: { marginLeft: number; marginTop: number }
  let arrowPos: ViewStyle
  let arrowShape: ViewStyle
  switch (direction) {
    case 'left':
      // Bubble sits to the LEFT of halo → its right edge faces the
      // halo → arrow on the right pointing right.
      offsetMargin = { marginLeft: -BUBBLE_W - HALO_R - GAP, marginTop: -BUBBLE_H_EST / 2 }
      arrowPos = { right: -ARROW, top: '50%', marginTop: -ARROW }
      arrowShape = arrowStyles.pointRight
      break
    case 'right':
      offsetMargin = { marginLeft: HALO_R + GAP, marginTop: -BUBBLE_H_EST / 2 }
      arrowPos = { left: -ARROW, top: '50%', marginTop: -ARROW }
      arrowShape = arrowStyles.pointLeft
      break
    case 'below':
      offsetMargin = { marginLeft: -BUBBLE_W / 2, marginTop: HALO_R + GAP }
      arrowPos = { top: -ARROW, left: '50%', marginLeft: -ARROW }
      arrowShape = arrowStyles.pointUp
      break
    case 'above':
      offsetMargin = { marginLeft: -BUBBLE_W / 2, marginTop: -BUBBLE_H_EST - HALO_R - GAP }
      arrowPos = { bottom: -ARROW, left: '50%', marginLeft: -ARROW }
      arrowShape = arrowStyles.pointDown
      break
  }

  const haloXPct = (pos.x / W) * 100
  const haloYPct = (pos.y / W) * 100

  const dayName = day.weekday
  const word = isToday ? 'hoy' : dayName.toLowerCase()
  const isFuture = day.archetype === ''

  return (
    <Animated.View
      entering={bubbleEntering}
      exiting={bubbleExiting}
      style={[
        bubbleStyles.bubble,
        {
          left: `${haloXPct}%`,
          top: `${haloYPct}%`,
          width: BUBBLE_W,
        },
        offsetMargin,
      ]}
      pointerEvents="auto"
    >
      {/* No-op Pressable consumes taps on the bubble body so the
          backdrop closer underneath doesn't dismiss the bubble
          when the user just wanted to read it. */}
      <Pressable onPress={() => {}} style={bubbleStyles.body}>
        {isFuture ? (
          <>
            <Animated.Text
              entering={FadeInDown.duration(220).delay(120).easing(Easing.out(Easing.cubic))}
              style={bubbleStyles.eyebrowMuted}
            >
              {dayName.toUpperCase()}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.duration(220).delay(180).easing(Easing.out(Easing.cubic))}
              style={bubbleStyles.vozFuture}
            >
              {day.note}
            </Animated.Text>
          </>
        ) : (
          <>
            <Animated.Text
              entering={FadeInDown.duration(220).delay(100).easing(Easing.out(Easing.cubic))}
              style={bubbleStyles.eyebrow}
            >
              {isToday ? (
                <>
                  <Text style={bubbleStyles.eyebrowAccent}>HOY</Text>
                  <Text> · {dayName.toUpperCase()}</Text>
                </>
              ) : (
                <Text style={bubbleStyles.eyebrowAccent}>{dayName.toUpperCase()}</Text>
              )}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.duration(220).delay(160).easing(Easing.out(Easing.cubic))}
              style={bubbleStyles.title}
            >
              <Text style={bubbleStyles.titleAccent}>{word}</Text>
              <Text> {day.archetype}</Text>
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.duration(220).delay(220).easing(Easing.out(Easing.cubic))}
              style={bubbleStyles.voz}
              numberOfLines={3}
            >
              {day.note}
            </Animated.Text>
            {isToday ? (
              <Animated.View
                entering={FadeInDown.duration(240)
                  .delay(300)
                  .easing(Easing.out(Easing.back(1.5)))}
              >
                <Pressable
                  onPress={onOpenDia}
                  style={({ pressed }) => [bubbleStyles.cta, pressed && bubbleStyles.ctaPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir Día"
                >
                  <Text style={bubbleStyles.ctaText}>Abrir Día →</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </>
        )}
      </Pressable>
      {/* Arrow extends out toward the halo AFTER the bubble has
          settled — a tiny "kick" that visually completes the
          connection from bubble to star. */}
      <Animated.View
        entering={ZoomIn.duration(280)
          .delay(140)
          .easing(Easing.out(Easing.back(2)))}
        style={[arrowStyles.base, arrowShape, arrowPos]}
        pointerEvents="none"
      />
    </Animated.View>
  )
}

// Bubble geometry — fixed width keeps positioning math simple;
// estimated height is used for vertical-centre offsets when the
// bubble is placed to the left/right of a halo. If actual content
// is taller/shorter, the centre is off by a few pixels — acceptable
// since the arrow keeps the connection unambiguous.
const BUBBLE_W = 172
const BUBBLE_H_EST = 100
const HALO_R = 14
const GAP = 14
const ARROW = 7

const bubbleStyles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.bruma,
    // Subtle shadow so the bubble lifts off the cosmos instead of
    // sitting flat. iOS-only props are ignored on Android.
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  eyebrowMuted: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  eyebrowAccent: {
    color: colors.magenta,
  },
  title: {
    marginTop: 5,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 21,
    color: colors.leche,
  },
  titleAccent: {
    color: colors.magenta,
  },
  voz: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 16,
    color: colors.bone,
  },
  vozFuture: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 16,
    color: colors.bone,
  },
  cta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1.2,
    borderColor: colors.magenta,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ctaPressed: {
    backgroundColor: colors.magentaTint,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
})

// CSS-triangle technique: a 0×0 element whose borders form four
// trapezoids meeting at the centre. Three transparent + one
// coloured = a directional triangle. The coloured border matches
// the bubble background so the arrow reads as part of the bubble.
const arrowStyles = StyleSheet.create({
  base: {
    width: 0,
    height: 0,
  },
  pointRight: {
    borderTopWidth: ARROW,
    borderBottomWidth: ARROW,
    borderLeftWidth: ARROW,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.bgCard,
  },
  pointLeft: {
    borderTopWidth: ARROW,
    borderBottomWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.bgCard,
  },
  pointUp: {
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderBottomWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.bgCard,
  },
  pointDown: {
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.bgCard,
  },
})

/* The week-progress arc — a soft magenta accent that traces the
 * outer orbit from DOM to HOY. Integrates with the dashed orbital
 * ellipses (same radius, slim stroke) rather than reading as a
 * foreign "highlighter" line. */
function ProgressArc({ todayIdx }: { todayIdx: number }) {
  if (todayIdx <= 0) return null
  const R = 144
  const sliceAng = (2 * Math.PI) / 7
  const startAngle = -Math.PI / 2
  const sweep = todayIdx * sliceAng
  const endAngle = startAngle + sweep
  const sx = CX + R * Math.cos(startAngle)
  const sy = CY + R * Math.sin(startAngle)
  const ex = CX + R * Math.cos(endAngle)
  const ey = CY + R * Math.sin(endAngle)
  const largeArc = sweep > Math.PI ? 1 : 0
  const d = `M ${sx} ${sy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}`
  return (
    <G>
      <Path
        d={d}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={2.4}
        strokeOpacity={0.18}
        strokeLinecap="round"
      />
      <Path
        d={d}
        fill="none"
        stroke={colors.magentaHot}
        strokeWidth={0.9}
        strokeOpacity={0.6}
        strokeLinecap="round"
      />
    </G>
  )
}

export function WeekConstellation({
  days,
  selectedIdx,
  onSelect,
  onOpenDia,
}: {
  days: readonly DiaSemana[]
  /** Always set — today is selected by default. */
  selectedIdx: number
  onSelect: (i: number) => void
  /** Called when the user taps the "Abrir Día" CTA inside today's
   *  bubble. Wired by the parent to switch tabs into Día. */
  onOpenDia: () => void
}) {
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  const spin = useSharedValue(0)
  // 1.5 s loop driving the tap-affordance ring on HOY.
  const todayPulse = useSharedValue(0)
  // Bubble visibility. Starts closed: the initial HOY view is just
  // the constellation. A halo tap opens the bubble; tapping the
  // backdrop closes it again. Selection state lives in the parent
  // (selectedIdx) — this only tracks whether the bubble is shown.
  const [bubbleOpen, setBubbleOpen] = useState(false)
  // Per-tap counter — increments on every halo press. Used as a
  // key for the HaloTapRipple so a fresh shockwave fires every
  // time, even when the user re-taps the already-selected halo.
  const [tapCount, setTapCount] = useState(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    spin.value = withRepeat(withTiming(1, { duration: 180000, easing: Easing.linear }), -1, false)
    todayPulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(spin)
      cancelAnimation(todayPulse)
    }
  }, [t, drift, spin, todayPulse])

  const popT = useSharedValue(0)
  useEffect(() => {
    popT.value = 0
    popT.value = withSequence(
      withTiming(1, { duration: 230, easing: Easing.out(Easing.back(2.4)) }),
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.cubic) }),
    )
  }, [selectedIdx, popT])

  const todayIdx = days.findIndex((d) => d.today)
  const exploring = selectedIdx !== todayIdx

  const dustSpin = useAnimatedProps(() => {
    'worklet'
    const deg = spin.value * 360
    return {
      transform: [
        { translateX: CX },
        { translateY: CY },
        { rotate: `${deg}deg` },
        { translateX: -CX },
        { translateY: -CY },
      ],
    }
  })
  const centerSpin = useAnimatedProps(() => {
    'worklet'
    const deg = -spin.value * 360 * 1.6
    return {
      transform: [
        { translateX: CX },
        { translateY: CY },
        { rotate: `${deg}deg` },
        { translateX: -CX },
        { translateY: -CY },
      ],
    }
  })

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
        <Defs>
          <RadialGradient id="weekCore" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="30%" stopColor="#FBD7E3" />
            <Stop offset="75%" stopColor={colors.magenta} />
            <Stop offset="100%" stopColor="#5A0E2A" />
          </RadialGradient>
          <RadialGradient id="weekBody" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
        </Defs>

        <SvgImage
          href={WEEK_ART_PNG}
          x={0}
          y={0}
          width={W}
          height={W}
          preserveAspectRatio="xMidYMid meet"
        />

        <G>
          {WEEK_DUST.map((m, i) => (
            <WeekDustMote key={`wdust-${i}`} mote={m} spin={spin} t={t} />
          ))}
        </G>

        <AnimatedG animatedProps={dustSpin}>
          {ORBIT_ELLIPSES.map((e, i) => (
            <Ellipse
              key={`orbit-${i}`}
              cx={CX}
              cy={CY}
              rx={e.rx}
              ry={e.ry}
              fill="none"
              stroke={colors.magentaHot}
              strokeWidth={e.strokeWidth}
              strokeDasharray={e.dash}
              strokeLinecap="round"
              opacity={e.opacity}
              transform={`rotate(${e.rotation} ${CX} ${CY})`}
            />
          ))}
        </AnimatedG>

        <ProgressArc todayIdx={todayIdx} />

        <AnimatedG animatedProps={centerSpin}>
          {CENTER_ELLIPSES.map((e, i) => (
            <Ellipse
              key={`center-${i}`}
              cx={CX}
              cy={CY}
              rx={e.rx}
              ry={e.ry}
              fill="none"
              stroke={colors.leche}
              strokeWidth={e.strokeWidth}
              strokeDasharray={e.dash}
              strokeLinecap="round"
              opacity={e.opacity}
              transform={`rotate(${e.rotation} ${CX} ${CY})`}
            />
          ))}
        </AnimatedG>

        {todayIdx >= 0 ? (
          <TodayPulseRing
            pos={DAY_POS[todayIdx]!}
            pulse={todayPulse}
            bodyR={6.2 + (days[todayIdx]?.brightness ?? 0) * 2.4}
          />
        ) : null}

        {/* One-shot shockwave from the tapped halo. Re-mounts on
            every tap via the tapCount key so each press fires a
            fresh ring, even when the same halo is re-tapped. */}
        {tapCount > 0 ? (
          <HaloTapRipple key={`ripple-${tapCount}`} pos={DAY_POS[selectedIdx]!} />
        ) : null}

        {days.map((d, i) => {
          const pos = DAY_POS[i]!
          const selected = i === selectedIdx
          const faded = exploring && !selected
          const future = todayIdx >= 0 && i > todayIdx
          if (future) {
            const proximity = i - todayIdx
            return (
              <DayGhost key={i} pos={pos} proximity={proximity} selected={selected} faded={faded} />
            )
          }
          return (
            <DayBody
              key={i}
              day={d}
              pos={pos}
              isToday={d.today}
              t={t}
              popT={popT}
              selected={selected}
              faded={faded}
              phase={(i * 0.17) % 1}
            />
          )
        })}

        {DAY_POS.map((pos, i) => {
          const isToday = i === todayIdx
          const future = todayIdx >= 0 && i > todayIdx
          return (
            <SvgText
              key={`label-${i}`}
              x={pos.x}
              y={pos.y - (isToday ? 30 : 22)}
              fill={isToday ? colors.magentaHot : colors.leche}
              fontFamily={isToday ? typography.serifSemi : typography.serif}
              fontSize={isToday ? 12 : 9}
              letterSpacing={isToday ? 1.8 : 1.2}
              textAnchor="middle"
              opacity={isToday ? 1 : future ? 0.4 : 0.85}
            >
              {isToday ? 'HOY' : DAY_LABELS[i]}
            </SvgText>
          )
        })}
        {DAY_POS.map((pos, i) => {
          const future = todayIdx >= 0 && i > todayIdx
          if (future) return null
          const letter = DAY_LETTERS[i]!
          const isMulti = letter.length > 1
          const isToday = i === todayIdx
          return (
            <SvgText
              key={`letter-${i}`}
              x={pos.x}
              y={pos.y + 4}
              fill={colors.leche}
              fontFamily={typography.serifSemi}
              fontSize={isMulti ? 9 : 11}
              textAnchor="middle"
              opacity={isToday ? 1 : 0.85}
            >
              {letter}
            </SvgText>
          )
        })}
      </Svg>

      {/* Backdrop — closes the bubble when the user taps anywhere
          outside of a halo or the bubble itself. Only mounted when
          the bubble is open, so it doesn't intercept taps on the
          constellation while it's at rest. Sits BELOW the halo
          Pressables so halos remain tappable to switch days. */}
      {bubbleOpen ? (
        <Pressable
          onPress={() => setBubbleOpen(false)}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
      ) : null}

      {DAY_POS.map((pos, i) => (
        <Pressable
          key={i}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            setBubbleOpen(true)
            setTapCount((n) => n + 1)
            onSelect(i)
          }}
          style={[styles.hit, { left: `${(pos.x / W) * 100}%`, top: `${(pos.y / W) * 100}%` }]}
          accessibilityRole="button"
          accessibilityState={{ selected: i === selectedIdx }}
          accessibilityLabel={days[i]?.weekday ?? ''}
        />
      ))}

      {/* The halo bubble — anchored to whatever day is currently
          selected. Sits on top of halos so it isn't occluded.
          The `key={selectedIdx}` re-mounts the bubble when the
          user taps a different halo, giving a cross-fade between
          the old position and the new one (the previous instance
          plays its FadeOut while the new instance plays FadeIn). */}
      {bubbleOpen && days[selectedIdx] ? (
        <HaloBubble
          key={selectedIdx}
          pos={DAY_POS[selectedIdx]!}
          day={days[selectedIdx]!}
          isToday={selectedIdx === days.findIndex((d) => d.today)}
          onOpenDia={onOpenDia}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    marginLeft: -HIT / 2,
    marginTop: -HIT / 2,
  },
})
