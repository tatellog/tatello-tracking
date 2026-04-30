import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { colors } from '@/theme'

type Props = {
  onPress: () => void
  disabled?: boolean
}

/*
 * Big round capture button with a mauve gradient core. Spring scale
 * 1 → 0.92 on press in feels like a physical shutter rather than a
 * generic Pressable. The outer ring is white so it reads against any
 * camera frame, dark or bright.
 */
export function CaptureButton({ onPress, disabled = false }: Props) {
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => {
        scale.value = withSpring(0.92, { stiffness: 380, damping: 18 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 280, damping: 14 })
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Tomar foto"
      accessibilityState={{ disabled }}
    >
      <Animated.View style={[styles.outer, disabled && styles.disabled, animStyle]}>
        <View style={styles.inner}>
          <LinearGradient
            colors={[colors.mauveLight, colors.mauveDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  outer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pearlElevated,
    borderWidth: 3,
    borderColor: colors.inkPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255,255,255,0.4)',
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
})
