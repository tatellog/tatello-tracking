import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { SelectableCard, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { type Goal } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'

const GOALS: readonly { value: Goal; label: string; description: string }[] = [
  {
    value: 'recomposition',
    label: 'Recomposición',
    description: 'Ganar músculo y bajar grasa al mismo tiempo.',
  },
  { value: 'lose_fat', label: 'Bajar grasa', description: 'Perder peso priorizando grasa.' },
  { value: 'gain_muscle', label: 'Ganar músculo', description: 'Subir peso priorizando músculo.' },
  { value: 'maintain', label: 'Mantener', description: 'Mantener mi físico actual.' },
]

export default function GoalScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [selected, setSelected] = useState<Goal | null>((profile?.goal as Goal | null) ?? null)

  const canContinue = selected !== null

  const handleContinue = () => {
    if (!selected) return
    updateProfile.mutate({ goal: selected }, { onSuccess: () => router.push('/onboarding/done') })
  }

  return (
    <WizardLayout
      step={6}
      totalSteps={6}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      ornamentVariant="tr"
    >
      <StepHeader
        eyebrow="Última pieza"
        eyebrowColor="mauve"
        question="¿Qué quieres lograr?"
        questionEmphasis="quieres lograr"
        hint="Esto guía cómo te sugerimos comer y entrenar."
      />

      <View style={styles.list}>
        {GOALS.map((goal) => (
          <SelectableCard
            key={goal.value}
            variant="row"
            label={goal.label}
            description={goal.description}
            selected={selected === goal.value}
            onPress={() => setSelected(goal.value)}
          />
        ))}
      </View>
    </WizardLayout>
  )
}

const styles = StyleSheet.create({
  list: {
    marginTop: 24,
    gap: 7,
  },
})
