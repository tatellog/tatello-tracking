import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'

// Shared 4-point star glyph — same vocabulary as the constellation
// itself, so the node-list and the diagram read as one design.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

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
  return (
    <View style={styles.list}>
      {/* Faint connecting branch — a thin vertical hairline passing
          through the node centres. Sits behind the nodes. */}
      <View style={styles.branch} pointerEvents="none" />

      {dimensions.map((dim) => {
        const enLuz = dim.brightness >= EN_LUZ_THRESHOLD
        const isSelected = dim.key === selectedKey
        const nodeOpacity = enLuz ? 0.6 + dim.brightness * 0.4 : 0.45
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
                  fill={enLuz ? colors.magenta : colors.niebla}
                  opacity={nodeOpacity}
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

const NODE_SIZE = 28

const styles = StyleSheet.create({
  // The whole list — a vertical column on the right side of the hero
  // row. Fixed-ish width so the diagram beside it can flex.
  list: {
    width: 92,
    justifyContent: 'center',
    paddingRight: 6,
    paddingVertical: 4,
    gap: 12,
  },
  // The connecting branch — absolute, sits on the centre line of the
  // node-circle column (NODE_SIZE/2 from the left edge of the list).
  branch: {
    position: 'absolute',
    top: 18,
    bottom: 18,
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
  // The node circle — a faint ring around the star icon. Lit
  // dimensions warm to magenta-tint; the selected one gains a clear
  // magenta border so the eye finds it instantly.
  nodeWrap: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bg,
  },
  nodeWrapLit: {
    borderColor: 'rgba(233, 30, 99, 0.4)',
    backgroundColor: colors.magentaTint,
  },
  nodeWrapSelected: {
    borderColor: colors.magenta,
    borderWidth: 1.4,
    backgroundColor: colors.magentaTint2,
  },
  label: {
    flex: 1,
    fontFamily: typography.uiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  labelLit: {
    color: colors.bone,
  },
  labelSelected: {
    color: colors.magenta,
  },
})
