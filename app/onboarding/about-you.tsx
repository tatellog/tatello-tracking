import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  DateOfBirthInput,
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

const MIN_AGE_YEARS = 13
const MAX_AGE_YEARS = 100
const DEFAULT_AGE_YEARS = 30

export default function AboutYouScreen() {
  const router = useRouter()
  // Opened from Ajustes (?source=settings) → save and return there;
  // otherwise this is the onboarding wizard → advance to the next step.
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const { defaultDate, minDate, maxDate } = useMemo(() => boundsForAdult(), [])

  const initialDob = useMemo(() => parseISODate(profile?.date_of_birth), [profile?.date_of_birth])

  const [name, setName] = useState(profile?.display_name ?? '')
  const [dob, setDob] = useState<Date | null>(initialDob)
  const [height, setHeight] = useState(profile?.height_cm ? String(profile.height_cm) : '')
  const [sex, setSex] = useState<BiologicalSex | null>(
    (profile?.biological_sex as BiologicalSex | null) ?? null,
  )

  const trimmedName = name.trim()
  const heightNum = Number(height)
  const dobValid = dob !== null && isAdultAge(dob)
  const heightValid = heightNum >= 100 && heightNum <= 230

  const canContinue =
    trimmedName.length >= 1 && trimmedName.length <= 40 && dobValid && heightValid && sex !== null

  const handleContinue = () => {
    if (!canContinue || !sex || !dob) return
    updateProfile.mutate(
      {
        display_name: trimmedName,
        date_of_birth: toISODate(dob),
        biological_sex: sex,
        height_cm: Math.round(heightNum),
      },
      {
        onSuccess: () => (fromSettings ? router.back() : router.push('/onboarding/weight')),
      },
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

          <View style={styles.field}>
            <DateOfBirthInput
              value={dob}
              onChange={setDob}
              defaultDate={defaultDate}
              minDate={minDate}
              maxDate={maxDate}
            />
          </View>

          <View style={styles.field}>
            <UnderlinedInput
              label="Altura · cm"
              value={height}
              onChangeText={(v) => setHeight(v.replace(/\D/g, '').slice(0, 3))}
              placeholder="170"
              keyboardType="number-pad"
              maxLength={3}
            />
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

function yearsAgo(years: number): Date {
  const now = new Date()
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
}

function boundsForAdult() {
  return {
    defaultDate: yearsAgo(DEFAULT_AGE_YEARS),
    minDate: yearsAgo(MAX_AGE_YEARS),
    maxDate: yearsAgo(MIN_AGE_YEARS),
  }
}

function isAdultAge(d: Date): boolean {
  const min = yearsAgo(MAX_AGE_YEARS).getTime()
  const max = yearsAgo(MIN_AGE_YEARS).getTime()
  const t = d.getTime()
  return t >= min && t <= max
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate(v: string | null | undefined): Date | null {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
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
