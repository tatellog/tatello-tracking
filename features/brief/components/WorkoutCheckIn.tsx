import { Pressable, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { duration, easing } from '@/design/motion'
import { shadow } from '@/design/tokens'
import { Prose } from '@/design/typography'

type Props = {
  completed: boolean
  onPress: () => void
}

/*
 * Tap feedback: subtle scale-down on pressIn (0.97) and decompression
 * on pressOut. Uses reanimated shared values so the work stays on the UI
 * thread and the animation never jank-fights the JS bridge.
 */
export function WorkoutCheckIn({ completed, onPress }: Props) {
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
    <Animated.View style={[shadow.sm, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={
          completed
            ? 'w-full flex-row items-center justify-center rounded-lg border border-accent-cool/40 bg-accent-cool-soft px-4 py-4'
            : 'w-full flex-row items-center justify-center rounded-lg border bg-paper px-4 py-4'
        }
      >
        {completed ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-base text-accent-cool-strong">✓</Text>
            <Prose className="text-accent-cool-strong">entrenado hoy</Prose>
          </View>
        ) : (
          <Prose>¿entrenaste hoy?</Prose>
        )}
      </Pressable>
    </Animated.View>
  )
}
