import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

const TRACK_HEIGHT = 56
const THUMB_SIZE = 48
const THUMB_INSET = 4
const COMMIT_RATIO = 0.85

type Props = {
  committed: boolean
  onConfirm: () => void
  onUndo: () => void
}

/**
 * Drag-to-commit slider. Releasing past `COMMIT_RATIO` snaps to 1 and
 * fires `onConfirm`; releasing earlier springs back to 0.
 */
export function SlideToConfirm({ committed, onConfirm, onUndo }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  const progress = useSharedValue(committed ? 1 : 0)
  const arrowOffset = useSharedValue(0)

  useEffect(() => {
    arrowOffset.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    return () => cancelAnimation(arrowOffset)
  }, [arrowOffset])

  useEffect(() => {
    progress.value = withTiming(committed ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.2, 0.7, 0.2, 1),
    })
  }, [committed, progress])

  const maxX = Math.max(0, trackWidth - THUMB_SIZE - THUMB_INSET * 2)

  const triggerConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onConfirm()
  }

  const pan = Gesture.Pan()
    .enabled(!committed)
    .onUpdate((e) => {
      if (maxX === 0) return
      progress.value = Math.max(0, Math.min(1, e.translationX / maxX))
    })
    .onEnd(() => {
      if (progress.value >= COMMIT_RATIO) {
        progress.value = withTiming(1, { duration: 180 }, () => runOnJS(triggerConfirm)())
      } else {
        progress.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })
      }
    })

  const fillStyle = useAnimatedStyle(() => ({
    width: THUMB_INSET + THUMB_SIZE + progress.value * maxX + THUMB_INSET,
  }))

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * maxX }],
  }))

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowOffset.value * 6 }],
    opacity: 1 - progress.value,
  }))

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={committed ? 'Entrenaste hoy' : 'Desliza para marcar entreno'}
    >
      <Animated.View style={[styles.fill, fillStyle, committed && styles.fillCommitted]}>
        <LinearGradient
          colors={[colors.magentaDeep, colors.magenta]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.contentOverlay} pointerEvents="none">
        <Text style={[styles.eyebrow, committed && styles.eyebrowOnFill]}>Hoy</Text>
        <Text style={[styles.title, committed && styles.titleOnFill]}>
          {committed ? 'Entrenaste hoy ★' : 'Desliza para entrenar'}
        </Text>
      </View>

      {!committed ? (
        <Animated.Text style={[styles.arrows, arrowStyle]} pointerEvents="none">
          {'›››'}
        </Animated.Text>
      ) : null}

      {committed ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
            onUndo()
          }}
          style={styles.undo}
          accessibilityRole="button"
          accessibilityLabel="Deshacer entreno"
          hitSlop={8}
        >
          <Text style={styles.undoGlyph}>×</Text>
        </Pressable>
      ) : null}

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Svg width={THUMB_SIZE} height={THUMB_SIZE} viewBox={`0 0 ${THUMB_SIZE} ${THUMB_SIZE}`}>
            <Defs>
              <RadialGradient id="thumb-grad" cx="35%" cy="35%" r="65%">
                <Stop offset="0%" stopColor="#FFB8D4" />
                <Stop offset="60%" stopColor="#E91E63" />
                <Stop offset="100%" stopColor="#7A1737" />
              </RadialGradient>
            </Defs>
            <Circle
              cx={THUMB_SIZE / 2}
              cy={THUMB_SIZE / 2}
              r={THUMB_SIZE / 2}
              fill="url(#thumb-grad)"
            />
            <Path
              d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3 8.2 13.9 2 9.4h7.6z"
              transform={`translate(${(THUMB_SIZE - 24) / 2}, ${(THUMB_SIZE - 24) / 2})`}
              fill="#FFFFFF"
            />
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    overflow: 'hidden',
    marginBottom: 18,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: TRACK_HEIGHT / 2,
    borderBottomLeftRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 4,
  },
  fillCommitted: {
    borderTopRightRadius: TRACK_HEIGHT / 2,
    borderBottomRightRadius: TRACK_HEIGHT / 2,
  },
  contentOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9,
    color: colors.bone,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  eyebrowOnFill: {
    color: 'rgba(255,255,255,0.75)',
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 18,
    color: colors.leche,
    letterSpacing: -0.7,
  },
  titleOnFill: {
    color: '#FFFFFF',
  },
  arrows: {
    position: 'absolute',
    right: 20,
    fontFamily: typography.displayHeavy,
    fontSize: 16,
    color: colors.magenta,
    letterSpacing: -2,
  },
  thumb: {
    position: 'absolute',
    top: THUMB_INSET,
    left: THUMB_INSET,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  undo: {
    position: 'absolute',
    right: 10,
    top: '50%',
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  undoGlyph: {
    fontFamily: typography.uiBold,
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 18,
  },
})
