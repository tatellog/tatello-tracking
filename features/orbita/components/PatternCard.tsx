import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Polyline, Rect } from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import type { Patron } from '../mock'

/* A tiny visual of the pattern's shape — bars, a curve, or a pulse. */
function PatternGlyph({ kind }: { kind: Patron['kind'] }) {
  if (kind === 'bars') {
    const h = [11, 19, 9, 23, 15]
    return (
      <Svg width={40} height={28} viewBox="0 0 40 28">
        {h.map((v, i) => (
          <Rect
            key={i}
            x={2 + i * 8}
            y={26 - v}
            width={5}
            height={v}
            rx={1.5}
            fill={colors.magenta}
            opacity={0.55 + (v / 23) * 0.45}
          />
        ))}
      </Svg>
    )
  }
  if (kind === 'curve') {
    return (
      <Svg width={40} height={28} viewBox="0 0 40 28">
        <Polyline
          points="2,22 11,18 19,20 27,7 38,13"
          fill="none"
          stroke={colors.magenta}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={27} cy={7} r={3} fill={colors.magenta} />
      </Svg>
    )
  }
  // pulse
  const dots = [
    { x: 5, r: 2 },
    { x: 15, r: 3 },
    { x: 25, r: 2.4 },
    { x: 35, r: 5 },
  ]
  return (
    <Svg width={40} height={28} viewBox="0 0 40 28">
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={14} r={d.r} fill={colors.magenta} opacity={0.5 + d.r / 10} />
      ))}
    </Svg>
  )
}

/*
 * One detected-pattern row: a mini-visual, the human reading (with its
 * accent word) and the sub-data. Tappable — a detail view comes later.
 */
export function PatternCard({ patron }: { patron: Patron }) {
  return (
    <Pressable style={styles.card} accessibilityRole="button" accessibilityLabel={patron.title}>
      <View style={styles.glyphBox}>
        <PatternGlyph kind={patron.kind} />
      </View>
      <View style={styles.textCol}>
        <EmText
          text={patron.title}
          emphasis={patron.emphasis}
          style={styles.title}
          emStyle={styles.em}
        />
        <Text style={styles.detail}>{patron.detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  glyphBox: {
    width: 40,
    marginRight: 14,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: 14.5,
    color: colors.leche,
  },
  // The accent word — serif italic magenta, the coach's emphasis.
  em: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 15.5,
    color: colors.magenta,
  },
  detail: {
    marginTop: 4,
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: colors.niebla,
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: 22,
    color: colors.bruma,
    marginLeft: 8,
  },
})
