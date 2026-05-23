import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'

// Clockwise traversal of the constellation from the top burst. The
// list mirrors how the eye walks around the figure, so the index
// reads as a *route* through the constellation, not an alphabetical
// dump.
const CLOCKWISE_ORDER: DimensionKey[] = ['mente', 'sueno', 'alimento', 'ciclo', 'energia', 'cuerpo']

/*
 * Per-dimension glyph — drawn inside a 24 × 24 viewport with white
 * fills/strokes. Each is a quick semantic shorthand for its domain
 * (heart for body, eye for mind, flame for energy, bowl for food,
 * crescent for sleep, spiral for cycle). Designed to read clearly
 * at ~14 px in the badge.
 */
const GLYPHS: Record<DimensionKey, ReactNode> = {
  cuerpo: (
    <Path
      d="M12 19 C8 15.5 3.5 12 3.5 7.8 C3.5 5.7 5.2 4 7.3 4 C9.3 4 10.8 5.2 12 6.8 C13.2 5.2 14.7 4 16.7 4 C18.8 4 20.5 5.7 20.5 7.8 C20.5 12 16 15.5 12 19 Z"
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
    <Path d="M13.6 3 L6.5 13.2 L10.6 13.2 L8.8 21 L17.5 9.8 L13 9.8 L14.8 3 Z" fill="#FFFFFF" />
  ),
  alimento: (
    <>
      {/* Bowl — a semicircle with a flat rim. */}
      <Path
        d="M3.5 11 L20.5 11 A8.5 8.5 0 0 1 3.5 11 Z M2.5 10.5 L21.5 10.5"
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* Two wisps of steam. */}
      <Path
        d="M8 7 Q9 4 10 7 M13 7 Q14 4 15 7 M11 5 Q12 2 13 5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </>
  ),
  sueno: (
    <Path
      d="M17 3.5 C12.5 3.5 8 7.5 8 12 C8 16.5 12.5 20.5 17 20.5 C14.5 18 13.5 15 13.5 12 C13.5 9 14.5 6 17 3.5 Z"
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
    <Svg width={36} height={36} viewBox="0 0 36 36">
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
      <Circle cx={18} cy={18} r={11.5} fill={colors.bgCard2} />
      {/* The ring around the disc. */}
      <Circle
        cx={18}
        cy={18}
        r={11.5}
        fill="none"
        stroke={ringStroke}
        strokeWidth={ringWidth}
        opacity={state === 'dim' ? 0.55 : 1}
      />
      {/* The glyph — drawn in its own 24 × 24 space, translated to
          sit centred inside the disc. */}
      <Svg x={6} y={6} width={24} height={24} viewBox="0 0 24 24">
        {glyph}
      </Svg>
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
 * its own glyph + a state-driven petal halo so the list itself
 * communicates which dimensions are en luz, lejos or selected
 * without the eye darting back to the constellation.
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
      {/* Faint connecting branch — a thin vertical hairline passing
          through the badge centres. Sits behind the badges. */}
      <View style={styles.branch} pointerEvents="none" />

      {ordered.map((dim) => {
        const enLuz = dim.brightness >= EN_LUZ_THRESHOLD
        const isSelected = dim.key === selectedKey
        const state: State = isSelected ? 'selected' : enLuz ? 'lit' : 'dim'
        return (
          <Pressable
            key={dim.key}
            onPress={() => onSelect(dim.key)}
            style={styles.row}
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

const BADGE_SIZE = 36

const styles = StyleSheet.create({
  // The whole list — a vertical column on the right side of the hero
  // row. Width holds room for the wider Genshin-style badge plus its
  // petals.
  list: {
    width: 112,
    justifyContent: 'center',
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
  },
  // The connecting branch — absolute, sits on the centre line of the
  // badge column (BADGE_SIZE/2 from the left edge of the list).
  branch: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    left: BADGE_SIZE / 2 - 0.5,
    width: 1,
    backgroundColor: colors.bruma,
    opacity: 0.45,
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
