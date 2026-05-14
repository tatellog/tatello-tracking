import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

type Props = {
  label: string
  /** Big number text, already formatted (e.g. "98", "1.5"). */
  value: string
  /** Italic serif unit suffix ("g", "kcal"). */
  unit: string
  /** Progress 0..1 — drives fill width. */
  pct: number
  footerLeft?: string
  footerLeftEmphasis?: string
  footerRight?: string
  footerRightEmphasis?: string
  /** Fill animation start delay in ms. */
  delay?: number
}

export function MacroLine({
  label,
  value,
  unit,
  pct,
  footerLeft,
  footerLeftEmphasis,
  footerRight,
  footerRightEmphasis,
  delay = 200,
}: Props) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(Math.min(1, Math.max(0, pct)), {
        duration: 1100,
        easing: Easing.bezier(0.2, 0.7, 0.2, 1),
      }),
    )
  }, [progress, pct, delay])

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <EyebrowLabel tone="magenta">{label}</EyebrowLabel>
        <Text style={styles.value}>
          {value}
          <Text style={styles.valueUnit}>{unit}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      {footerLeft || footerRight ? (
        <View style={styles.botRow}>
          {footerLeft ? (
            <EmText
              text={footerLeft}
              emphasis={footerLeftEmphasis}
              emStyle={styles.botBold}
              style={styles.bot}
            />
          ) : (
            <View />
          )}
          {footerRight ? (
            <EmText
              text={footerRight}
              emphasis={footerRightEmphasis}
              emStyle={styles.botBold}
              style={styles.bot}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 26,
    color: colors.leche,
    letterSpacing: -1,
    lineHeight: 26,
  },
  valueUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.bone,
  },
  track: {
    height: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.magenta,
    borderRadius: 3,
  },
  botRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bot: {
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.niebla,
  },
  botBold: {
    fontFamily: typography.uiBold,
    color: colors.leche,
  },
})
