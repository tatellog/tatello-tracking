import { Feather } from '@expo/vector-icons'
import { Pressable } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { duration, easing } from '@/design/motion'
import { shadow, useColors } from '@/design/tokens'
import { Prose } from '@/design/typography'

type Props = {
  completed: boolean
  onPress: () => void
}

/*
 * Primary CTA — capsule pill that shifts mood with state:
 *   Idle     — rose-gold filled, cream text. Warm invitation.
 *   Completed — sage-soft filled, checkmark + sage text. Cool confirmation.
 *
 * The temperature shift mirrors the workout arc: warm activation before,
 * cool rest after. Tap feedback runs on the UI thread (reanimated shared
 * value) so the press never fights the JS bridge.
 */
export function WorkoutCheckIn({ completed, onPress }: Props) {
  const colors = useColors()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  return (
    <Animated.View style={[shadow.md, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={
          completed
            ? 'w-full flex-row items-center justify-center gap-2 rounded-full border border-accent-cool/40 bg-accent-cool-soft px-5 py-4'
            : 'w-full flex-row items-center justify-center gap-2 rounded-full bg-accent-warm px-5 py-4'
        }
      >
        <Feather
          name={completed ? 'check' : 'sunrise'}
          size={16}
          color={completed ? colors.accent.coolStrong : colors.content.onAccent}
        />
        <Prose className={completed ? 'text-accent-cool-strong' : 'text-on-accent'}>
          {completed ? 'Entrenado hoy' : '¿Entrenaste hoy?'}
        </Prose>
      </Pressable>
    </Animated.View>
  )
}
