import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

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
const GLYPHS: Record<DimensionKey, ReactNode> = {
  cuerpo: (
    <Path
      d="M12 20 C8.5 17 4.5 14 4.5 10 C4.5 8 6 6.5 8 6.5 C9.7 6.5 11 7.5 12 9 C13 7.5 14.3 6.5 16 6.5 C18 6.5 19.5 8 19.5 10 C19.5 14 15.5 17 12 20 Z"
      fill="#FFFFFF"
    />
  ),
  mente: (
    <>
      <Circle cx={12} cy={12} r={7.2} fill="none" stroke="#FFFFFF" strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={2.6} fill="#FFFFFF" />
    </>
  ),
  energia: (
    <Path
      d="M13.5 3.5 L6.5 13.2 L10.5 13.2 L9 20.5 L17.5 10.5 L13.5 10.5 L15 3.5 Z"
      fill="#FFFFFF"
    />
  ),
  alimento: (
    <>
      {/* Bowl — a semicircle sitting just below centre so the heavy
          mass lands at the disc midpoint. */}
      <Path
        d="M4.5 12 L19.5 12 A7.5 7.5 0 0 1 4.5 12 Z"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {/* Three steam wisps above the bowl. */}
      <Path
        d="M8 8 Q9 5.5 10 8 M14 8 Q15 5.5 16 8 M11 6 Q12 3.5 13 6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </>
  ),
  sueno: (
    <Path
      d="M17 3.5 C11.5 3.5 7 7.5 7 12 C7 16.5 11.5 20.5 17 20.5 C14 18 13 15 13 12 C13 9 14 6 17 3.5 Z"
      fill="#FFFFFF"
    />
  ),
  ciclo: (
    <>
      <Path
        d="M19 12 A7 7 0 1 1 12 5 A4.5 4.5 0 1 0 16.5 9.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={12} r={1.6} fill="#FFFFFF" />
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

// Per-row horizontal offset — the BADGES trace a single CRESCENT
// (media luna) arc from top to bottom: the two endpoints sit on
// the right side of the list, the middle pair bulges to the left.
// Computed from a half-period sine wave so the shape is smooth and
// symmetric: `offset(t) = AMP - AMP · sin(t · π)` for t = i/(N-1).
// Tracing the resulting badge centres gives a clean ⊃ shape that
// curves toward the constellation on the diagram's right edge.
const X_AMP = 16
const X_OFFSETS = Array.from({ length: 6 }, (_, i) =>
  Math.round(X_AMP - X_AMP * Math.sin((i / 5) * Math.PI)),
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
 * Five smooth C-curves connecting the snake-curve of badges. Each
 * segment runs from the bottom of badge `i` to the top of badge
 * `i+1`, with both control points pinned to vertical tangents at
 * the endpoints — control 1 stays on x = badgeCenterX(i) and
 * control 2 stays on x = badgeCenterX(i+1). The curve therefore
 * exits the lower badge going straight down and approaches the
 * next badge from above going straight down; all the horizontal
 * motion happens in the middle of the span, producing the soft
 * S-shapes from the reference.
 */
function buildConnectorPath(): string {
  const cmds: string[] = []
  for (let i = 0; i < 5; i++) {
    const x0 = badgeCenterX(i)
    const y0 = badgeCenterY(i) + PETAL_REACH
    const x1 = badgeCenterX(i + 1)
    const y1 = badgeCenterY(i + 1) - PETAL_REACH
    const span = y1 - y0
    const c1y = y0 + span * 0.4
    const c2y = y1 - span * 0.4
    cmds.push(`M ${x0} ${y0} C ${x0} ${c1y}, ${x1} ${c2y}, ${x1} ${y1}`)
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
function DimensionBadge({ glyph, state }: { glyph: ReactNode; state: State }) {
  const petalOp = state === 'selected' ? 1 : state === 'lit' ? 0.8 : 0.25
  const ringStroke =
    state === 'selected' ? colors.leche : state === 'lit' ? colors.magenta : colors.bruma
  const ringWidth = state === 'selected' ? 1.7 : state === 'lit' ? 1.3 : 1
  // A faint backdrop glow sits behind the disc when lit/selected so
  // the node feels lit-from-within against the dark page bg.
  const glowOp = state === 'selected' ? 0.55 : state === 'lit' ? 0.32 : 0
  return (
    <Svg width={BADGE_SIZE} height={BADGE_SIZE} viewBox="0 0 36 36">
      {/* Backdrop glow — a soft magenta wash behind the badge that
          only switches on for lit/selected. */}
      {glowOp > 0 ? (
        <Circle cx={18} cy={18} r={15} fill={colors.magenta} opacity={glowOp * 0.5} />
      ) : null}
      {/* Four cardinal petals (top, right, bottom, left). Tapered
          diamonds — narrow and pointed outward. */}
      <Path d="M18 1.6 L20.4 5.4 L18 8.4 L15.6 5.4 Z" fill={colors.magenta} opacity={petalOp} />
      <Path d="M34.4 18 L30.6 20.4 L27.6 18 L30.6 15.6 Z" fill={colors.magenta} opacity={petalOp} />
      <Path d="M18 34.4 L20.4 30.6 L18 27.6 L15.6 30.6 Z" fill={colors.magenta} opacity={petalOp} />
      <Path d="M1.6 18 L5.4 20.4 L8.4 18 L5.4 15.6 Z" fill={colors.magenta} opacity={petalOp} />
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
          react-native-svg renderer. */}
      <G transform="translate(6, 6)">{glyph}</G>
    </Svg>
  )
}

type Props = {
  dimensions: readonly Dimension[]
  selectedKey: DimensionKey | null
  onSelect: (key: DimensionKey) => void
}

/*
 * The right-side dimension list — six tappable Genshin-style nodes
 * stacked along the right edge of the Día hero. Each node carries
 * its own glyph + a state-driven petal halo; an SVG connector path
 * snakes between them so the list reads as a skill-tree branch.
 */
export function DimensionNodeList({ dimensions, selectedKey, onSelect }: Props) {
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
            <DimensionBadge glyph={GLYPHS[dim.key]} state={state} />
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
