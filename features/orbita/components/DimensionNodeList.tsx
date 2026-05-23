import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'

// Shared 4-point star glyph — same vocabulary as the constellation
// itself, so the node-list and the diagram read as one design.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

// Clockwise traversal of the constellation from the top burst. The
// list mirrors how the eye walks around the figure, so the index
// reads as a *route* through the constellation, not an alphabetical
// dump.
const CLOCKWISE_ORDER: DimensionKey[] = ['mente', 'sueno', 'alimento', 'ciclo', 'energia', 'cuerpo']

type Props = {
  dimensions: readonly Dimension[]
  selectedKey: DimensionKey | null
  onSelect: (key: DimensionKey) => void
}

/*
 * The right-side dimension list — six tappable nodes stacked along
 * the right edge of the Día hero, in the style of Genshin Impact's
 * character Constellation page. Each node is a small star + label;
 * the brightness of the star reflects the dimension's live state
 * (lit = magenta, quiet = niebla). Tapping a node selects that
 * dimension; the constellation diagram and the readout below sync.
 *
 * A faint vertical line connects the nodes — same look as the
 * skill-tree branch in the reference image.
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
          through the node centres. Sits behind the nodes. */}
      <View style={styles.branch} pointerEvents="none" />

      {ordered.map((dim) => {
        const enLuz = dim.brightness >= EN_LUZ_THRESHOLD
        const isSelected = dim.key === selectedKey
        return (
          <Pressable
            key={dim.key}
            onPress={() => onSelect(dim.key)}
            style={styles.row}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dim.label}
          >
            <View
              style={[
                styles.nodeWrap,
                enLuz && styles.nodeWrapLit,
                isSelected && styles.nodeWrapSelected,
              ]}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path
                  d={STAR_PATH}
                  fill={enLuz ? '#FFFFFF' : colors.niebla}
                  opacity={enLuz ? 0.95 : 0.5}
                />
              </Svg>
            </View>
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

const NODE_SIZE = 26

const styles = StyleSheet.create({
  // The whole list — a vertical column on the right side of the hero
  // row. Width bumped 92 → 100 so `ALIMENTO` fits without ellipsis at
  // the new tighter font size.
  list: {
    width: 100,
    justifyContent: 'center',
    paddingRight: 6,
    paddingVertical: 4,
    gap: 12,
  },
  // The connecting branch — absolute, sits on the centre line of the
  // node-circle column (NODE_SIZE/2 from the left edge of the list).
  branch: {
    position: 'absolute',
    top: 16,
    bottom: 16,
    left: NODE_SIZE / 2 - 0.5,
    width: 1,
    backgroundColor: colors.bruma,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // The node circle — three clearly different visual states so the
  // list itself communicates which dimensions are en luz, lejos or
  // selected without the eye having to dart back to the diagram.
  //
  // - Default (lejos): faint outline, transparent fill, dim star.
  // - Lit:    SOLID magenta fill, white star icon → reads as "on".
  // - Selected: cream outline ring sits around either state.
  nodeWrap: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: 'transparent',
  },
  nodeWrapLit: {
    borderColor: colors.magenta,
    backgroundColor: colors.magenta,
  },
  nodeWrapSelected: {
    borderColor: colors.leche,
    borderWidth: 1.6,
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
