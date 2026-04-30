import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { SelectableCard, StepHeader, WizardLayout } from '@/features/onboarding/components'
import { type BiologicalSex } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'

export default function BiologicalSexScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [selected, setSelected] = useState<BiologicalSex | null>(
    (profile?.biological_sex as BiologicalSex | null) ?? null,
  )

  const canContinue = selected !== null

  const handleContinue = () => {
    if (!selected) return
    updateProfile.mutate(
      { biological_sex: selected },
      { onSuccess: () => router.push('/onboarding/height') },
    )
  }

  return (
    <WizardLayout
      step={3}
      totalSteps={6}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      ornamentVariant="tr"
    >
      <StepHeader
        eyebrow="Una más"
        eyebrowColor="muted"
        question="¿Tu sexo biológico?"
        questionEmphasis="biológico"
        hint="Es solo para calcular tu metabolismo. No define tu identidad."
      />

      <View style={styles.row}>
        <SelectableCard
          variant="square"
          label="Femenino"
          icon="♀"
          selected={selected === 'female'}
          onPress={() => setSelected('female')}
        />
        <SelectableCard
          variant="square"
          label="Masculino"
          icon="♂"
          selected={selected === 'male'}
          onPress={() => setSelected('male')}
        />
      </View>
    </WizardLayout>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
  },
})
