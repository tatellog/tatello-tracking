import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
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
 * Swipe-to-seal replaces the old 'did you train today?' button.
 *
 * Flow:
 *   1. User drags the thumb right.
 *   2. translateX clamps at [0, trackWidth - THUMB_SIZE - padding×2].
 *   3. On release: past 80% → medium haptic + onSeal() + spring to end,
 *      enter sealed state (no more gestures). Below 80% → spring back
 *      to 0 and stay idle.
 *
 * If the parent passes `sealed: true` on mount (e.g. the user already
 * logged today's workout earlier), the thumb snaps to the end state
 * without a gesture.
 *
 * Requires GestureHandlerRootView mounted at the app root.
 */
export function SwipeToSeal({ sealed, onSeal }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  const [completed, setCompleted] = useState(sealed)
  const translateX = useSharedValue(0)

  const maxTranslate = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PADDING * 2)

  useEffect(() => {
    if (trackWidth === 0) return
    setCompleted(sealed)
    translateX.value = withSpring(sealed ? maxTranslate : 0, { damping: 20 })
  }, [sealed, trackWidth, maxTranslate, translateX])

  const triggerSeal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCompleted(true)
    onSeal()
  }, [onSeal])

  const panGesture = Gesture.Pan()
    .enabled(!completed && trackWidth > 0)
    .onUpdate((event) => {
      translateX.value = Math.min(maxTranslate, Math.max(0, event.translationX))
    })
    .onEnd(() => {
      if (translateX.value > maxTranslate * COMPLETE_RATIO) {
        translateX.value = withSpring(maxTranslate, { damping: 18 })
        runOnJS(triggerSeal)()
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
      <View style={[styles.track, completed && styles.trackSealed]} onLayout={handleLayout}>
        <View style={styles.labelWrap} pointerEvents="none">
          <Text style={[styles.label, completed && styles.labelSealed]}>
            {completed ? '✓ Día sellado' : 'Desliza para sellar el día'}
          </Text>
        </View>
        {!completed && (
          <View style={styles.hintWrap} pointerEvents="none">
            <Text style={styles.hint}>›››</Text>
          </View>
        )}
        <Animated.View style={[styles.thumbWrap, thumbStyle]}>
          <View style={[styles.thumb, completed && styles.thumbSealed]}>
            <Text style={[styles.thumbArrow, completed && styles.thumbArrowSealed]}>
              {completed ? '✓' : '›'}
            </Text>
          </View>
        </Animated.View>
      </View>
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
