import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import type { MoodValue } from '@/features/moods/api'
import { colors, spacing, typography } from '@/theme'

type Option = { value: MoodValue; emoji: string; accessibility: string }

const OPTIONS: readonly Option[] = [
  { value: 'good', emoji: '😌', accessibility: 'bien' },
  { value: 'neutral', emoji: '😐', accessibility: 'neutral' },
  { value: 'struggle', emoji: '😣', accessibility: 'pesado' },
] as const

type Props = {
  value: MoodValue | null
  onChange: (value: MoodValue) => void
}

/*
 * Three orbs. Tap scales the picked one up (1.18) and fades the
 * other two down (0.9 / 0.5). A light haptic fires on every tap.
 *
 * Persistence is the parent's job — the onChange callback typically
 * dispatches a useAddMoodCheckin mutation, which on success
 * invalidates the brief so `value` updates from the refetch. The
 * orb therefore stays selected without local state coupling.
 */
export function MoodPicker({ value, onChange }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.question}>¿CÓMO TE SIENTES?</Text>
      <View style={styles.orbs}>
        {OPTIONS.map((option) => (
          <MoodOrb
            key={option.value}
            option={option}
            selected={value === option.value}
            anySelected={value !== null}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onChange(option.value)
            }}
          />
        ))}
      </View>
    </View>
  )
}

type OrbProps = {
  option: Option
  selected: boolean
  anySelected: boolean
  onPress: () => void
}

function MoodOrb({ option, selected, anySelected, onPress }: OrbProps) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  useEffect(() => {
    const target = selected ? 1.18 : anySelected ? 0.9 : 1
    const dim = anySelected && !selected ? 0.5 : 1
    scale.value = withSpring(target, { damping: 12, stiffness: 120 })
    opacity.value = withSpring(dim, { damping: 14, stiffness: 110 })
  }, [selected, anySelected, scale, opacity])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Pressable onPress={onPress} accessibilityLabel={option.accessibility}>
      <Animated.View style={[styles.orb, selected && styles.orbSelected, animStyle]}>
        <Text style={styles.emoji}>{option.emoji}</Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  question: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
    marginBottom: spacing.md,
  },
  orbs: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  orb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.pearlMuted,
    borderWidth: 0.5,
    borderColor: colors.borderDashed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbSelected: {
    borderColor: colors.mauveDeep,
    borderWidth: 1.2,
  },
  emoji: {
    fontSize: 22,
  },
})
