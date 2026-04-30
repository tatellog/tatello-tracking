import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native'

import { NumberInput, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const MIN_CM = 130
const MAX_CM = 220

export default function HeightScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [value, setValue] = useState<string>(profile?.height_cm ? String(profile.height_cm) : '')

  const num = value === '' ? Number.NaN : Number(value)
  const isValid = Number.isFinite(num) && num >= MIN_CM && num <= MAX_CM
  const showError = value.length > 0 && !isValid

  const handleContinue = () => {
    if (!isValid) return
    updateProfile.mutate(
      { height_cm: Math.round(num) },
      { onSuccess: () => router.push('/onboarding/weight') },
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={4}
        totalSteps={6}
        canContinue={isValid}
        loading={updateProfile.isPending}
        errorMessage={updateProfile.error?.message}
        onContinue={handleContinue}
        ornamentVariant="bl"
      >
        <StepHeader
          eyebrow="Vamos bien"
          eyebrowColor="muted"
          question="¿Cuánto mides?"
          questionEmphasis="mides"
          hint="En centímetros."
        />

        <NumberInput
          value={value}
          onChangeText={setValue}
          unit="cm"
          placeholder="165"
          decimal={false}
          autoFocus
        />

        {showError ? (
          <Text style={styles.error}>
            Entre {MIN_CM} y {MAX_CM} cm.
          </Text>
        ) : null}
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  error: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.feedbackError,
  },
})
