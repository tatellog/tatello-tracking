import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import { colors, radius, shadows, spacing, typography } from '@/theme'

const THUMB_SIZE = 54
const TRACK_PADDING = 4
const COMPLETE_RATIO = 0.8

type Props = {
  sealed: boolean
  onSeal: () => void | Promise<void>
}

/*
 * Swipe-to-seal — fully controlled.
 *
 * The `sealed` prop is the single source of truth for whether the
 * button is in its 'after' state. The component does not maintain
 * its own completed flag: the thumb's translateX animates from 0
 * to maxTranslate (or back) whenever `sealed` changes, and the
 * gesture fires `onSeal()` without flipping any local state.
 *
 * Why controlled: a previous revision kept an internal `completed`
 * state synced from `sealed` via useEffect. That pattern drifts
 * during edge cases (prop flips mid-gesture, optimistic parent
 * updates that race with the gesture end) and violated the
 * controlled/uncontrolled React rule. With truth in the prop the
 * parent decides everything and the component just animates.
 *
 * Requires GestureHandlerRootView mounted at the app root.
 */
export function SwipeToSeal({ sealed, onSeal }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  const translateX = useSharedValue(0)

  const maxTranslate = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PADDING * 2)

  // Whenever the parent flips sealed (or the track width lands),
  // snap the thumb to the matching position. If the gesture was
  // already in-flight, withSpring cancels the previous animation.
  useEffect(() => {
    if (trackWidth === 0) return
    translateX.value = withSpring(sealed ? maxTranslate : 0, { damping: 20 })
  }, [sealed, trackWidth, maxTranslate, translateX])

  const fireSeal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onSeal()
  }

  const panGesture = Gesture.Pan()
    .enabled(!sealed && trackWidth > 0)
    .onUpdate((event) => {
      translateX.value = Math.min(maxTranslate, Math.max(0, event.translationX))
    })
    .onEnd(() => {
      if (translateX.value > maxTranslate * COMPLETE_RATIO) {
        translateX.value = withSpring(maxTranslate, { damping: 18 })
        runOnJS(fireSeal)()
      } else {
        translateX.value = withSpring(0, { damping: 20 })
      }
    })

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width)
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={sealed ? 'Día sellado' : 'Desliza para sellar el día de entreno'}
        accessibilityHint={sealed ? undefined : 'Arrastrá el botón hacia la derecha para completar'}
        accessibilityState={{ selected: sealed, disabled: sealed }}
        onPress={() => {
          // Screen-reader fallback: users who can't perform the pan
          // gesture still need a way to seal the day. Activation via
          // AT fires onSeal directly.
          if (!sealed) fireSeal()
        }}
        style={[styles.track, sealed && styles.trackSealed]}
        onLayout={handleLayout}
      >
        <View style={styles.labelWrap} pointerEvents="none">
          <Text style={[styles.label, sealed && styles.labelSealed]}>
            {sealed ? '✓ Día sellado' : 'Desliza para sellar el día'}
          </Text>
        </View>
        {!sealed && (
          <View style={styles.hintWrap} pointerEvents="none">
            <Text style={styles.hint}>›››</Text>
          </View>
        )}
        <Animated.View style={[styles.thumbWrap, thumbStyle]} pointerEvents="none">
          <View style={[styles.thumb, sealed && styles.thumbSealed]}>
            <Text style={[styles.thumbArrow, sealed && styles.thumbArrowSealed]}>
              {sealed ? '✓' : '›'}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  track: {
    height: THUMB_SIZE + TRACK_PADDING * 2,
    borderRadius: radius.pill,
    backgroundColor: colors.forestDeep,
    padding: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.card,
  },
  trackSealed: {
    backgroundColor: colors.forestMid,
  },

  labelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    color: colors.creamWarm,
    fontStyle: 'italic',
  },
  labelSealed: {
    color: colors.creamSoft,
  },

  hintWrap: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    color: colors.copperBright,
    fontSize: 16,
    fontWeight: '700',
  },

  thumbWrap: {
    alignSelf: 'flex-start',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.creamWarm,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.copperToday,
  },
  thumbSealed: {
    backgroundColor: colors.copperBright,
  },
  thumbArrow: {
    fontSize: 20,
    color: colors.forestDeep,
    fontWeight: '700',
  },
  thumbArrowSealed: {
    color: colors.creamWarm,
  },
})
