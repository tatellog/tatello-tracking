import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Cosmic chrome for the Semana footer — the "en números" card, the
 * micro-observations and the section breaks live in the OBSERVATORY's
 * light (oro), not the hero's magenta. Pure SVG primitives (no asset
 * transformer), tinted from the theme. See illustrator direction.
 */

const STAR_PATH = 'M8 1.5 L9.1 6.9 L14.5 8 L9.1 9.1 L8 14.5 L6.9 9.1 L1.5 8 L6.9 6.9 Z'

/* Faint star-dust wash for the recap card — concentrated top-left,
 * dissipating, with one hair-thin constellation thread. Sits behind the
 * grid inside an overflow-hidden, rounded container. */
export function RecapDust() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 320 200" preserveAspectRatio="xMidYMin slice">
        <Circle cx={34} cy={26} r={1.1} fill={colors.oro} opacity={0.55} />
        <Circle cx={78} cy={18} r={0.7} fill={colors.oro} opacity={0.35} />
        <Circle cx={120} cy={34} r={0.9} fill={colors.oro} opacity={0.3} />
        <Circle cx={58} cy={52} r={0.6} fill={colors.oro} opacity={0.22} />
        <Circle cx={180} cy={22} r={0.7} fill={colors.oro} opacity={0.2} />
        <Circle cx={246} cy={40} r={0.6} fill={colors.oro} opacity={0.14} />
        <Circle cx={300} cy={28} r={0.9} fill={colors.oro} opacity={0.1} />
        <Path d="M34 26 L78 18 L120 34" stroke={colors.oro} strokeWidth={0.4} opacity={0.16} />
      </Svg>
    </View>
  )
}

/* The radiant star for the "días en luz" line — the one selective glow
 * of the recap (oroLight). */
export function LuzStar({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d={STAR_PATH} stroke={colors.oroLight} strokeWidth={0.9} strokeLinejoin="round" />
    </Svg>
  )
}

/* A quiet cosmic break between footer sections — three decreasing stars
 * on an asymmetric thread, in oro. */
export function SectionDivider() {
  return (
    <View style={styles.divider} pointerEvents="none">
      <Svg width={60} height={8} viewBox="0 0 48 8" fill="none">
        <Line x1={2} y1={4} x2={18} y2={4} stroke={colors.oro} strokeWidth={0.5} opacity={0.22} />
        <Circle cx={24} cy={4} r={1.3} fill={colors.oro} />
        <Circle cx={31} cy={4} r={0.8} fill={colors.oro} opacity={0.6} />
        <Circle cx={37} cy={4} r={0.5} fill={colors.oro} opacity={0.4} />
        <Line x1={30} y1={4} x2={46} y2={4} stroke={colors.oro} strokeWidth={0.5} opacity={0.14} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  divider: {
    alignItems: 'center',
    marginVertical: 20,
  },
})
