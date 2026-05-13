import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  SegmentedToggle,
  StepHeader,
  UnderlinedInput,
  WizardLayout,
} from '@/features/onboarding/components'
import { type BiologicalSex } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const SEX_OPTIONS = [
  { value: 'female' as const, label: 'Femenino' },
  { value: 'male' as const, label: 'Masculino' },
]

/*
 * Screen 3 · Cuéntame de ti. Combina lo que antes eran cuatro
 * pantallas (nombre, fecha de nacimiento, sexo biológico, altura)
 * en una sola — el design Norte sostiene que el form fatigue de
 * cuatro pasos no agrega contexto al usuario.
 *
 *   • Nombre (texto)
 *   • Edad (1–3 dígitos) + Altura cm (1–3 dígitos) en grid de 2
 *   • Sexo biológico (segmented Femenino/Masculino) + sub
 *     "metabolismo, no identidad" en Cormorant niebla
 *
 * Edad → fecha de nacimiento. Nuestro schema requiere `date_of_birth`
 * (YYYY-MM-DD); convertimos asumiendo "cumpleaños el 1 de enero" del
 * año correspondiente. Es lo suficientemente bueno para calcular
 * BMR; cuando el usuario quiera la fecha exacta puede editarla en
 * Settings.
 */
export default function AboutYouScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const initialAge = useMemo(() => {
    if (!profile?.date_of_birth) return ''
    const parts = profile.date_of_birth.split('-').map(Number)
    const y = parts[0]
    if (!y) return ''
    return String(new Date().getFullYear() - y)
  }, [profile?.date_of_birth])

  const [name, setName] = useState(profile?.display_name ?? '')
  const [age, setAge] = useState(initialAge)
  const [height, setHeight] = useState(profile?.height_cm ? String(profile.height_cm) : '')
  const [sex, setSex] = useState<BiologicalSex | null>(
    (profile?.biological_sex as BiologicalSex | null) ?? null,
  )

  const trimmedName = name.trim()
  const ageNum = Number(age)
  const heightNum = Number(height)
  const ageValid = ageNum >= 13 && ageNum <= 99
  const heightValid = heightNum >= 100 && heightNum <= 230

  const canContinue =
    trimmedName.length >= 1 && trimmedName.length <= 40 && ageValid && heightValid && sex !== null

  const handleContinue = () => {
    if (!canContinue || !sex) return
    const dob = ageToISODate(ageNum)
    updateProfile.mutate(
      {
        display_name: trimmedName,
        date_of_birth: dob,
        biological_sex: sex,
        height_cm: Math.round(heightNum),
      },
      { onSuccess: () => router.push('/onboarding/weight') },
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={3}
        canContinue={canContinue}
        loading={updateProfile.isPending}
        errorMessage={updateProfile.error?.message}
        onContinue={handleContinue}
      >
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepHeader
            eyebrow="Para conocerte"
            eyebrowColor="magenta"
            question="Cuéntame de ti."
            questionEmphasis="Cuéntame"
            hint="Vive en tu teléfono. Nada se comparte."
          />

          <View style={styles.field}>
            <UnderlinedInput
              label="Tu nombre"
              value={name}
              onChangeText={setName}
              placeholder="Anahí"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <UnderlinedInput
                label="Edad"
                value={age}
                onChangeText={(v) => setAge(v.replace(/\D/g, '').slice(0, 3))}
                placeholder="36"
                keyboardType="number-pad"
                maxLength={3}
                compact
              />
            </View>
            <View style={styles.col}>
              <UnderlinedInput
                label="Altura · cm"
                value={height}
                onChangeText={(v) => setHeight(v.replace(/\D/g, '').slice(0, 3))}
                placeholder="170"
                keyboardType="number-pad"
                maxLength={3}
                compact
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PARA CALCULAR METABOLISMO</Text>
            <SegmentedToggle value={sex} options={SEX_OPTIONS} onChange={setSex} />
            <Text style={styles.caveat}>metabolismo, no identidad</Text>
          </View>
        </ScrollView>
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

function ageToISODate(age: number): string {
  const year = new Date().getFullYear() - age
  // Fecha sintética: 1 de enero del año correspondiente. El BMR no
  // depende del día exacto, sólo del año aproximado.
  return `${year}-01-01`
}

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  field: {
    marginTop: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 22,
  },
  col: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  caveat: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 11,
    color: colors.niebla,
    textAlign: 'center',
  },
})
