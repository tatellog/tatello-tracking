import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, G, Line, Pattern, Rect } from 'react-native-svg'

import { colors, typography } from '@/theme'

type Props = {
  /** Magenta uppercase prefix, e.g. "DÍA 1". */
  prefix: string
  /** Mono-uppercase niebla body, e.g. "tu foto\nde hoy". */
  caption: string
  height?: number
}

/**
 * Photo-placeholder slot — diagonal hatching + dashed bruma border +
 * 4 px magenta registration dot. RN's `borderStyle: 'dashed'` doesn't
 * render reliably on every platform, so we draw the dashed rectangle
 * via SVG with `strokeDasharray`.
 */
export function PhotoPlaceholder({ prefix, caption, height = 72 }: Props) {
  return (
    <View style={[styles.slot, { height }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern
            id="hatch"
            patternUnits="userSpaceOnUse"
            width={12}
            height={12}
            patternTransform="rotate(45)"
          >
            <Line x1={0} y1={0} x2={0} y2={12} stroke="rgba(244,236,222,0.06)" strokeWidth={6} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#hatch)" rx={4} />
        <G>
          <Rect
            x={0.5}
            y={0.5}
            width="99%"
            height="99%"
            fill="none"
            stroke={colors.bruma}
            strokeWidth={1}
            strokeDasharray="4 3"
            rx={4}
          />
        </G>
      </Svg>
      <View style={styles.registrationDot} />
      <View style={styles.captionWrap}>
        <Text style={styles.prefix}>{prefix.toUpperCase()}</Text>
        <Text style={styles.caption}>{caption}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  registrationDot: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.magenta,
    opacity: 0.6,
  },
  captionWrap: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  prefix: {
    fontFamily: typography.uiBold,
    fontSize: 8.5,
    color: colors.magenta,
    letterSpacing: 1.9,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: 8.5,
    color: colors.niebla,
    letterSpacing: 1.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
})
