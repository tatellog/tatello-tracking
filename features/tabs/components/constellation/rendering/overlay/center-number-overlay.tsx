import { StyleSheet, Text, View, type TextInputProps } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { AnimatedTextInput } from '../../animation/animated-components'
import { H, TARGET_DAYS } from '../../constants'

/* React Native overlay positioned over the SVG centre. Uses the
 * AnimatedTextInput `text` prop trick (same pattern as StreakNumber)
 * so the integer climb runs on the UI thread without re-rendering
 * React. `marginTop: -22` biases the baseline upward to match the
 * old SvgText y = cy - 4. */

export function CenterNumberOverlay({
  displayedCount,
  numberPulse,
  plusOne,
  initialCount,
  urgent = false,
  remaining = 0,
}: {
  displayedCount: SharedValue<number>
  numberPulse: SharedValue<number>
  plusOne: SharedValue<number>
  initialCount: number
  /** Final-stretch flag — last 3 days before completion. Switches
   *  the chip to a celebratory state (extra microcopy + warmer
   *  tone) so the user sees they're almost there. */
  urgent?: boolean
  /** Days remaining until completion. Used by the urgency
   *  microcopy ("falta 1", "faltan 2", etc.). */
  remaining?: number
}) {
  const rounded = useDerivedValue(() => Math.round(displayedCount.value))
  const textProps = useAnimatedProps(() => {
    const text = String(rounded.value)
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>
  })
  // Opacity ramps from 0.42 at count=0 to 1.0 once the user has marked
  // at least one day — the dim "0" reads as "waiting for you to begin"
  // rather than a bright assertion. The commit scale-pop is bigger now
  // (0.18, was 0.08) so the increment lands as a beat, not a twitch.
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + numberPulse.value * 0.18 }],
    opacity: 0.42 + Math.min(1, displayedCount.value) * 0.58,
  }))
  // The digit flashes pale at the peak of the pop — magenta → near
  // white → magenta — so the eye catches the number *changing*.
  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(numberPulse.value, [0, 1], [colors.magenta, '#FFF3FA']),
  }))
  // The "+1" ghost — rises ~22 px and fades. Appears fast, holds
  // briefly, gone by the end of the ramp.
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plusOne.value, [0, 0.12, 0.6, 1], [0, 1, 1, 0]),
    transform: [{ translateY: -plusOne.value * 22 }],
  }))
  return (
    <View style={styles.numberOverlay} pointerEvents="none">
      <Animated.View style={[styles.numberRow, pulseStyle]}>
        <View style={styles.chipFrameDot} />
        <View style={styles.chipFrameLine} />
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          animatedProps={textProps}
          defaultValue={String(initialCount)}
          style={[styles.numberOverlayText, colorStyle]}
        />
        <Text style={styles.numberDenominator}>/ {TARGET_DAYS} días</Text>
        <View style={styles.chipFrameLine} />
        <View style={styles.chipFrameDot} />
      </Animated.View>
      {urgent && remaining > 0 ? (
        <Text style={styles.urgencyHint}>
          {remaining === 1 ? 'una más' : `faltan ${remaining}`}
        </Text>
      ) : null}
      <Animated.View style={[styles.plusOne, ghostStyle]} pointerEvents="none">
        <Text style={styles.plusOneText}>+1</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Footer container — sits directly below the SVG canvas so the
  // chip lives in its own row, never overlapping the constellation.
  numberOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  numberOverlayText: {
    // Shrunk from 52 → 24 so the count reads as metadata, not as
    // visual hero. The constellation IS the progress now; the
    // number is a literal-data complement, not a separate focal.
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    letterSpacing: -0.6,
    textAlign: 'center',
    // Soft pink textShadow kept for warmth, halved from before.
    textShadowColor: 'rgba(233,30,99,0.32)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    padding: 0,
    includeFontPadding: false,
    minWidth: 28,
  },
  numberDenominator: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 1.0,
    marginLeft: 6,
  },
  // Decorative chip frame — thin niebla hairlines + bullet dots
  // flanking the count, so the chip reads as a designed UI element
  // rather than plain text floating in the constellation.
  chipFrameLine: {
    width: 18,
    height: 1,
    backgroundColor: colors.niebla,
    opacity: 0.6,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  chipFrameDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.bone,
    opacity: 0.85,
    alignSelf: 'center',
  },
  // Urgency microcopy — appears only in the final 3 days. Tiny
  // italic warm tag below the count chip ("una más" / "faltan 2").
  urgencyHint: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.magenta,
    letterSpacing: 0.6,
    marginTop: 2,
    textTransform: 'lowercase',
  },
  // The "+1" ghost — floats above the counter and rises out on each
  // commit. Absolute so it never shifts the centred number's layout.
  plusOne: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: H / 2 - 62,
    alignItems: 'center',
  },
  plusOneText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.magenta,
    textShadowColor: 'rgba(233,30,99,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
})
