import { Feather } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { duration, easing } from '@/design/motion'
import { useColors } from '@/design/tokens'
import { Prose } from '@/design/typography'
import { useThemeStore, type ThemePreference } from '@/design/theme'

type Option = {
  value: ThemePreference
  icon: keyof typeof Feather.glyphMap
  label: string
}

const options: readonly Option[] = [
  { value: 'light', icon: 'sun', label: 'Claro' },
  { value: 'dark', icon: 'moon', label: 'Oscuro' },
  { value: 'system', icon: 'smartphone', label: 'Sistema' },
] as const

export function ThemePicker() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <View className="flex-row gap-1 rounded-lg border bg-paper p-1">
      {options.map((option) => (
        <Segment
          key={option.value}
          option={option}
          active={preference === option.value}
          onSelect={setPreference}
        />
      ))}
    </View>
  )
}

type SegmentProps = {
  option: Option
  active: boolean
  onSelect: (value: ThemePreference) => void
}

function Segment({ option, active, onSelect }: SegmentProps) {
  const colors = useColors()
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const onPressIn = () => {
    scale.value = withTiming(0.96, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  return (
    <Animated.View style={[animatedStyle, { flex: 1 }]}>
      <Pressable
        onPress={() => onSelect(option.value)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        className={
          active
            ? 'flex-row items-center justify-center gap-2 rounded-md bg-canvas py-3'
            : 'flex-row items-center justify-center gap-2 rounded-md py-3'
        }
      >
        <Feather
          name={option.icon}
          size={14}
          color={active ? colors.content.primary : colors.content.tertiary}
        />
        <Prose className={active ? 'text-sm text-primary' : 'text-sm text-tertiary'}>
          {option.label}
        </Prose>
      </Pressable>
    </Animated.View>
  )
}
