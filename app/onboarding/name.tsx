import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native'

import { StepHeader, WizardLayout } from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

export default function NameScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [name, setName] = useState(profile?.display_name ?? '')

  const trimmed = name.trim()
  const canContinue = trimmed.length >= 1 && trimmed.length <= 40

  const handleContinue = () => {
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSuccess: () => router.push('/onboarding/date-of-birth'),
        // onError leaves mutation.error populated; WizardLayout
        // surfaces it inline so the user sees the failure instead of
        // silently bouncing off the Continue button.
      },
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={1}
        totalSteps={6}
        showBack={false}
        canContinue={canContinue}
        loading={updateProfile.isPending}
        errorMessage={updateProfile.error?.message}
        onContinue={handleContinue}
      >
        <StepHeader
          eyebrow="Para conocernos"
          eyebrowColor="mauve"
          question="¿Cómo te llamas?"
          questionEmphasis="llamas"
          hint="Para personalizar tus notas y que la app sepa quién eres."
        />
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          autoCorrect={false}
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canContinue) handleContinue()
          }}
          style={styles.input}
          placeholder="Tu nombre"
          placeholderTextColor={colors.labelDim}
        />
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  input: {
    marginTop: 24,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.mauveDeep,
    fontFamily: typography.display,
    fontSize: 28,
    letterSpacing: -1,
    color: colors.inkPrimary,
    backgroundColor: 'transparent',
  },
})
