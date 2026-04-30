import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

import { NumberInput, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { useInsertInitialWeight, useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const MIN_KG = 30
const MAX_KG = 300

export default function WeightScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const insertWeight = useInsertInitialWeight()
  const [value, setValue] = useState<string>('')

  const num = value === '' ? Number.NaN : Number(value)
  const isValid = Number.isFinite(num) && num >= MIN_KG && num <= MAX_KG
  const showError = value.length > 0 && !isValid

  const handleContinue = () => {
    if (!isValid) return
    insertWeight.mutate(Number(num.toFixed(1)), {
      onSuccess: () => {
        // The goal step is the last data point. Skip it if the user
        // has already set one (re-running the wizard from a partial
        // state).
        router.push(profile?.goal ? '/onboarding/done' : '/onboarding/goal')
      },
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={5}
        totalSteps={6}
        canContinue={isValid}
        loading={insertWeight.isPending}
        errorMessage={insertWeight.error?.message}
        onContinue={handleContinue}
        ornamentVariant="tl-small"
      >
        <View style={styles.flex}>
          <StepHeader
            eyebrow="El punto de partida"
            eyebrowColor="mauve"
            question="Hoy pesas..."
            questionEmphasis="pesas"
            hint="Solo el comienzo. Cambiará — eso es lo que vamos a ver juntas."
          />

          <NumberInput
            value={value}
            onChangeText={setValue}
            unit="kg"
            placeholder="70"
            decimal
            autoFocus
          />

          {showError ? (
            <Text style={styles.error}>
              Entre {MIN_KG} y {MAX_KG} kg.
            </Text>
          ) : null}

          {/* "Próximo capítulo" sits at the bottom of the content area,
              foreshadowing why the number on screen matters: in 4 / 12
              weeks it'll have a comparison partner. marginTop: 'auto'
              keeps it pinned regardless of how tall the input grows. */}
          <View style={styles.contextCard}>
            <Text style={styles.contextEyebrow}>Próximo capítulo</Text>
            <Text style={styles.contextText}>
              En 4 semanas verás tu primera comparativa. En 12 semanas, el cambio será evidente.
            </Text>
          </View>
        </View>
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  flex: {
    flex: 1,
  },
  error: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.feedbackError,
  },
  contextCard: {
    marginTop: 'auto',
    marginBottom: 14,
    backgroundColor: 'rgba(168, 94, 124, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  contextEyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 6,
  },
  contextText: {
    fontFamily: typography.ui,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkPrimary,
  },
})
