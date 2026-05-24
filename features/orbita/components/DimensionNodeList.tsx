import { useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, G, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import {
  getConstellationProfile,
  type ConstellationIntensity,
  type ConstellationProfile,
} from '../constants/constellationTheme'
import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'

// Clockwise traversal of the constellation from the top burst. The
// list mirrors how the eye walks around the figure, so the index
// reads as a *route* through the constellation, not an alphabetical
// dump.
const CLOCKWISE_ORDER: DimensionKey[] = ['mente', 'sueno', 'alimento', 'ciclo', 'energia', 'cuerpo']

/*
 * Per-dimension glyph — drawn inside a 24 × 24 viewport with white
 * fills/strokes. Each path has been re-centred on (12, 12) so its
 * visible mass sits at the disc centre when the glyph is translated
 * into the badge. Adjustments per glyph:
 *
 *   cuerpo  — heart shifted down 1 unit; the visual centroid of a
 *             heart sits above its bbox centre (lobes at top, point
 *             at bottom), so the bbox needs to be slightly bottom-
 *             heavy to read as centred.
 *   alimento— bowl raised + steam compacted so the heavy bowl mass
 *             sits at the badge centre, not below it.
 *   sueno   — crescent body slid right so the *moon body* (not the
 *             empty opening) lands on centre.
 *   mente, energia, ciclo — already centred by their geometry.
 */
// Glyph fills + strokes use `currentColor` so the SAME source-of-
// truth shapes can be tinted differently per host:
//
//   • The badge list wraps each GLYPH in a parent <G color="#FFFFFF">
//     so the icons read white on the magenta disc (no change to
//     the badge appearance).
//   • OrbitalSystem's StarNode wraps the same GLYPH in a parent
//     <G color="#FBD7E3"> (cream) so the icon at the zoomed star
//     centre reads as warm-pink on the magenta bloom — a softer
//     tone than the bright white-hot core it replaces during zoom.
export const GLYPHS: Record<DimensionKey, ReactNode> = {
  cuerpo: (
    <Path
      d="M12 20 C8.5 17 4.5 14 4.5 10 C4.5 8 6 6.5 8 6.5 C9.7 6.5 11 7.5 12 9 C13 7.5 14.3 6.5 16 6.5 C18 6.5 19.5 8 19.5 10 C19.5 14 15.5 17 12 20 Z"
      fill="currentColor"
    />
  ),
  mente: (
    <>
      <Circle cx={12} cy={12} r={7.2} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={2.6} fill="currentColor" />
    </>
  ),
  energia: (
    <Path
      d="M13.5 3.5 L6.5 13.2 L10.5 13.2 L9 20.5 L17.5 10.5 L13.5 10.5 L15 3.5 Z"
      fill="currentColor"
    />
  ),
  alimento: (
    <>
      {/* Bowl — a semicircle sitting just below centre so the heavy
          mass lands at the disc midpoint. */}
      <Path
        d="M4.5 12 L19.5 12 A7.5 7.5 0 0 1 4.5 12 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Three steam wisps above the bowl. */}
      <Path
        d="M8 8 Q9 5.5 10 8 M14 8 Q15 5.5 16 8 M11 6 Q12 3.5 13 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </>
  ),
  sueno: (
    <Path
      d="M17 3.5 C11.5 3.5 7 7.5 7 12 C7 16.5 11.5 20.5 17 20.5 C14 18 13 15 13 12 C13 9 14 6 17 3.5 Z"
      fill="currentColor"
    />
  ),
  ciclo: (
    <>
      <Path
        d="M19 12 A7 7 0 1 1 12 5 A4.5 4.5 0 1 0 16.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={12} r={1.6} fill="currentColor" />
    </>
  ),
}

type State = 'dim' | 'lit' | 'selected'

const BADGE_SIZE = 36
const BADGE_R = 11.5 // inner disc radius (used by DimensionBadge)
const PAD_V = 4
const GAP_V = 14
const LIST_WIDTH = 124
const LIST_HEIGHT = PAD_V * 2 + 6 * BADGE_SIZE + 5 * GAP_V
// Y-offset from a badge's centre out to its petal tip. The
// connector starts/ends just BEYOND the petal so it emerges into
// the gap instead of being clipped by the badge's own silhouette.
const PETAL_REACH = 17

// Per-row horizontal offset — the BADGES trace a single ")" arc
// from top to bottom: the two endpoints sit on the LEFT edge of
// the list, the middle pair bulges to the RIGHT (away from the
// diagram). Computed from a half-period sine: `offset(t) = AMP ·
// sin(t · π)` for t = i/(N-1). The resulting badge centres draw a
// clean right-paren shape ).
const X_AMP = 22
const X_OFFSETS = Array.from({ length: 6 }, (_, i) =>
  Math.round(X_AMP * Math.sin((i / 5) * Math.PI)),
) as readonly number[]

/** Centre X of badge `i` within the list View (left = 0). */
function badgeCenterX(i: number): number {
  return X_OFFSETS[i]! + BADGE_SIZE / 2
}

/** Centre Y of badge `i` within the list View (top = 0). */
function badgeCenterY(i: number): number {
  return PAD_V + i * (BADGE_SIZE + GAP_V) + BADGE_SIZE / 2
}

/*
 * Five STRAIGHT line segments linking the badges. The badges are
 * what trace the ")" curve — the connectors are chords (straight
 * lines) between consecutive badge perimeters. Tracing them in
 * order produces a polygonal approximation of a curve, which is
 * exactly the visual the user is after.
 */
function buildConnectorPath(): string {
  const cmds: string[] = []
  for (let i = 0; i < 5; i++) {
    const x0 = badgeCenterX(i)
    const y0 = badgeCenterY(i) + PETAL_REACH
    const x1 = badgeCenterX(i + 1)
    const y1 = badgeCenterY(i + 1) - PETAL_REACH
    cmds.push(`M ${x0} ${y0} L ${x1} ${y1}`)
  }
  return cmds.join(' ')
}

const CONNECTOR_PATH = buildConnectorPath()

/*
 * The Genshin-style constellation node: an inner dark disc with a
 * cream/magenta ring, four magenta petals at the cardinal points
 * radiating outward, and a white glyph centred inside. State drives
 * petal opacity, ring colour and ring weight:
 *
 *   dim      — petals 0.25, ring bruma          (lejos)
 *   lit      — petals 0.80, ring magenta solid  (en luz)
 *   selected — petals 1.00, ring leche, thicker (cream halo)
 */
function DimensionBadge({
  glyph,
  state,
  pulseClock,
  profile,
}: {
  glyph: ReactNode
  state: State
  pulseClock: SharedValue<number>
  profile: ConstellationProfile
}) {
  const petalOp = state === 'selected' ? 1 : state === 'lit' ? 0.8 : 0.25
  const ringStroke =
    state === 'selected' ? colors.leche : state === 'lit' ? colors.magenta : colors.bruma
  // Selected ring noticeably thicker (2.6 vs 1.3 lit / 1 dim). On
  // top of that, a second cream-coloured HALO ring sits OUTSIDE
  // the disc only on the selected badge — see the render below.
  // Combined the two rings make "selected" unmistakable vs "lit",
  // which were reading as identical (both bright rings) on a dark
  // bg.
  const ringWidth = state === 'selected' ? 2.6 : state === 'lit' ? 1.3 : 1
  // Backdrop glow — stronger on selected so the node clearly
  // "lights up" from behind when picked.
  const glowOp = state === 'selected' ? 0.75 : state === 'lit' ? 0.32 : 0
  const isSelected = state === 'selected'
  // Pulse only applies to the selected badge — everything else
  // stays still. The worklet reads the prop on every frame, so
  // toggling `state` flips between pulsing and steady without
  // remounting.
  const pulseStyle = useAnimatedStyle(() => {
    if (!isSelected) {
      return { transform: [{ scale: 1 }], opacity: 1 }
    }
    const wave = 0.5 + 0.5 * Math.sin(pulseClock.value * 2 * Math.PI)
    return {
      transform: [{ scale: 1 + wave * profile.badgePulseScale }],
      opacity: 1 - profile.badgePulseOpacity * (1 - wave),
    }
  })
  return (
    <Animated.View style={pulseStyle}>
      <Svg width={BADGE_SIZE} height={BADGE_SIZE} viewBox="0 0 36 36">
        {/* Backdrop glow — a soft magenta wash behind the badge that
          only switches on for lit/selected. Selected gets a WIDER
          glow (full viewBox) so the lighting-from-behind feels
          stronger; lit stays tight. */}
        {glowOp > 0 ? (
          <Circle
            cx={18}
            cy={18}
            r={isSelected ? 19 : 15}
            fill={colors.magenta}
            opacity={glowOp * 0.5}
          />
        ) : null}
        {/* Four cardinal petals (top, right, bottom, left). Tapered
          diamonds — narrow and pointed outward. */}
        <Path d="M18 1.6 L20.4 5.4 L18 8.4 L15.6 5.4 Z" fill={colors.magenta} opacity={petalOp} />
        <Path
          d="M34.4 18 L30.6 20.4 L27.6 18 L30.6 15.6 Z"
          fill={colors.magenta}
          opacity={petalOp}
        />
        <Path
          d="M18 34.4 L20.4 30.6 L18 27.6 L15.6 30.6 Z"
          fill={colors.magenta}
          opacity={petalOp}
        />
        <Path d="M1.6 18 L5.4 20.4 L8.4 18 L5.4 15.6 Z" fill={colors.magenta} opacity={petalOp} />
        {/* Outer halo ring — ONLY on the selected badge. Sits
          OUTSIDE the disc so the selected node looks haloed +
          clearly different from "lit". This is the visual cue
          that resolves the prior "lit and selected look the same"
          ambiguity. */}
        {isSelected ? (
          <Circle
            cx={18}
            cy={18}
            r={BADGE_R + 4.5}
            fill="none"
            stroke={colors.leche}
            strokeWidth={1.3}
            opacity={0.7}
          />
        ) : null}
        {/* The dark disc — sits on top of the petals so the petals
          read as radiating from behind the badge. */}
        <Circle cx={18} cy={18} r={BADGE_R} fill={colors.bgCard2} />
        {/* The ring around the disc. */}
        <Circle
          cx={18}
          cy={18}
          r={BADGE_R}
          fill="none"
          stroke={ringStroke}
          strokeWidth={ringWidth}
          opacity={state === 'dim' ? 0.55 : 1}
        />
        {/* The glyph — drawn in its own 24 × 24 space, translated to
          sit centred inside the disc. Using `G transform` instead of
          a nested <Svg> so positioning is dead-reliable across the
          react-native-svg renderer. `color="#FFFFFF"` propagates as
          the resolved value of `currentColor` for every fill/stroke
          inside the glyph (the glyphs use currentColor so they can
          be tinted cream when rendered in the OrbitalSystem zoom). */}
        <G transform="translate(6, 6)" color="#FFFFFF">
          {glyph}
        </G>
      </Svg>
    </Animated.View>
  )
}

type Props = {
  dimensions: readonly Dimension[]
  selectedKey: DimensionKey | null
  onSelect: (key: DimensionKey) => void
  /** Animation intensity for the selected-badge pulse. Default 'medium'. */
  intensity?: ConstellationIntensity
}

/*
 * The right-side dimension list — six tappable Genshin-style nodes
 * stacked along the right edge of the Día hero. Each node carries
 * its own glyph + a state-driven petal halo; an SVG connector path
 * snakes between them so the list reads as a skill-tree branch.
 */
export function DimensionNodeList({
  dimensions,
  selectedKey,
  onSelect,
  intensity = 'medium',
}: Props) {
  const reducedMotion = useReducedMotion()
  const profile = getConstellationProfile(intensity, reducedMotion ?? false)

  // A single shared clock drives the selected-badge pulse — only the
  // selected DimensionBadge actually reads it; the rest of the
  // badges ignore it. Always-running clock is cheaper than
  // start/stopping on selection (no remount).
  const pulseClock = useSharedValue(0)
  useEffect(() => {
    if (profile.badgePulseScale === 0 && profile.badgePulseOpacity === 0) {
      pulseClock.value = 0
      return
    }
    pulseClock.value = withRepeat(
      withTiming(1, { duration: profile.badgePulseDurationMs, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(pulseClock)
  }, [profile.badgePulseScale, profile.badgePulseOpacity, profile.badgePulseDurationMs, pulseClock])

  // Reorder by the constellation's clockwise traversal so walking the
  // list = walking the figure (top → upper-right → lower-right →
  // bottom → lower-left → upper-left). `deriveDimensions` returns
  // them in a fixed engine order; we project here so the engine and
  // the visual representation each keep their own ordering rules.
  const ordered = CLOCKWISE_ORDER.map((k) => dimensions.find((d) => d.key === k)).filter(
    (d): d is Dimension => d != null,
  )

  return (
    <View style={styles.list}>
      {/* Connector branch — an SVG curve snaking through the six
          badge centres. Absolute, sits behind the badges; pointer
          events disabled so taps fall through to the badges. */}
      <Svg width={LIST_WIDTH} height={LIST_HEIGHT} style={styles.connector} pointerEvents="none">
        <Path
          d={CONNECTOR_PATH}
          fill="none"
          stroke={colors.bruma}
          strokeWidth={1.2}
          strokeLinecap="round"
          opacity={0.7}
        />
      </Svg>

      {ordered.map((dim, i) => {
        const enLuz = dim.brightness >= EN_LUZ_THRESHOLD
        const isSelected = dim.key === selectedKey
        const state: State = isSelected ? 'selected' : enLuz ? 'lit' : 'dim'
        return (
          <Pressable
            key={dim.key}
            onPress={() => onSelect(dim.key)}
            // marginLeft drives the crescent layout — each row sits
            // at X_OFFSETS[i] from the list's left edge so the badges
            // trace the media-luna arc instead of stacking vertically.
            style={[styles.row, { marginLeft: X_OFFSETS[i] }]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dim.label}
          >
            <DimensionBadge
              glyph={GLYPHS[dim.key]}
              state={state}
              pulseClock={pulseClock}
              profile={profile}
            />
            <Text
              style={[styles.label, enLuz && styles.labelLit, isSelected && styles.labelSelected]}
              numberOfLines={1}
            >
              {dim.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  // The whole list — a column at the right side of the hero row.
  // Height is the intrinsic stack height (LIST_HEIGHT) so the SVG
  // connector and the badges share an explicit coordinate frame.
  list: {
    width: LIST_WIDTH,
    height: LIST_HEIGHT,
    paddingTop: PAD_V,
    paddingBottom: PAD_V,
    paddingRight: 4,
    gap: GAP_V,
  },
  // The connector sits behind the badge stack, aligned to the
  // badge column.
  connector: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: 1,
    fontFamily: typography.uiBold,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  labelLit: {
    color: colors.leche,
  },
  labelSelected: {
    color: colors.magenta,
  },
})
