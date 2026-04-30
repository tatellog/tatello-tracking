import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { createElement, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { StepHeader, WizardLayout } from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const DEFAULT_AGE_YEARS = 30
const MIN_AGE_YEARS = 13
const MAX_AGE_YEARS = 100

export default function DateOfBirthScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const { defaultDate, minDate, maxDate } = useMemo(() => bounds(), [])

  const initial = useMemo(() => {
    if (profile?.date_of_birth) {
      const parsed = new Date(profile.date_of_birth)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return defaultDate
  }, [profile?.date_of_birth, defaultDate])

  const [date, setDate] = useState<Date>(initial)
  const [showPicker, setShowPicker] = useState<boolean>(Platform.OS === 'ios')

  const age = useMemo(() => calculateAge(date), [date])

  const handleChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (value) setDate(value)
  }

  const handleContinue = () => {
    updateProfile.mutate(
      { date_of_birth: toISODate(date) },
      { onSuccess: () => router.push('/onboarding/biological-sex') },
    )
  }

  // Step 2 — eyebrow renders the user's name in the same mauve tone
  // but in title case ("Sofía,") rather than uppercase, signalling the
  // wizard is now talking *to* them by name.
  const eyebrow = profile?.display_name ? `${profile.display_name},` : 'Para conocernos'
  const eyebrowCase: 'upper' | 'none' = profile?.display_name ? 'none' : 'upper'

  return (
    <WizardLayout
      step={2}
      totalSteps={6}
      canContinue
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
      ornamentVariant="tl-small"
    >
      <StepHeader
        eyebrow={eyebrow}
        eyebrowColor="mauve"
        eyebrowCase={eyebrowCase}
        question="¿cuándo naciste?"
        questionEmphasis="naciste"
        hint="Esto nos ayuda a calcular tu metabolismo."
      />

      <View style={styles.pickerWrap}>
        {Platform.OS === 'web' ? (
          <WebDateInput
            value={toISODate(date)}
            min={toISODate(minDate)}
            max={toISODate(maxDate)}
            onChange={(v) => {
              const next = parseISODate(v)
              if (next) setDate(next)
            }}
          />
        ) : (
          <>
            {Platform.OS === 'android' && !showPicker ? (
              <Pressable onPress={() => setShowPicker(true)} style={styles.androidTrigger}>
                <Text style={styles.androidTriggerLabel}>{formatDateLong(date)}</Text>
              </Pressable>
            ) : null}
            {showPicker ? (
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                maximumDate={maxDate}
                onChange={handleChange}
                textColor={colors.inkPrimary}
                style={styles.picker}
              />
            ) : null}
          </>
        )}
      </View>

      <Text style={styles.computedAge}>
        <Text style={styles.computedAgeNumber}>{age} años</Text>
      </Text>
    </WizardLayout>
  )
}

function bounds() {
  const now = new Date()
  const ofAge = (years: number) =>
    new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
  return {
    defaultDate: ofAge(DEFAULT_AGE_YEARS),
    minDate: ofAge(MAX_AGE_YEARS),
    maxDate: ofAge(MIN_AGE_YEARS),
  }
}

function calculateAge(birthDate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }
  return age
}

function toISODate(d: Date): string {
  // YYYY-MM-DD in local time. Avoids the timezone slippage that
  // toISOString() introduces by converting to UTC first.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISODate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/*
 * Web-only date input. RNW renders DOM elements directly so a native
 * <input type="date"> gives us a proper datepicker without pulling
 * in another library. We style it to match the wizard's typography.
 *
 * @react-native-community/datetimepicker doesn't support web, so the
 * native branch above is the sole path on iOS/Android; this branch
 * is the sole path on web.
 */
function WebDateInput({
  value,
  min,
  max,
  onChange,
}: {
  value: string
  min: string
  max: string
  onChange: (v: string) => void
}) {
  // RNW lets us render a real <input> on web, but TS doesn't see DOM
  // typings in the React Native types. createElement bypasses JSX so
  // we don't need a directive that the iOS/Android compile flags as
  // unused.
  return createElement('input', {
    type: 'date',
    value,
    min,
    max,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    style: {
      fontFamily: typography.display,
      fontSize: 22,
      letterSpacing: -0.5,
      color: colors.inkPrimary,
      backgroundColor: colors.pearlElevated,
      border: `1px solid ${colors.borderSubtle}`,
      borderRadius: 12,
      padding: '14px 16px',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
    },
  })
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
}

const styles = StyleSheet.create({
  pickerWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  picker: {
    width: '100%',
  },
  androidTrigger: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  androidTriggerLabel: {
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.inkPrimary,
    letterSpacing: -0.5,
  },
  computedAge: {
    marginTop: 16,
    alignSelf: 'center',
    fontFamily: typography.ui,
    fontSize: 13,
    color: colors.labelMuted,
  },
  computedAgeNumber: {
    fontFamily: typography.uiMedium,
    color: colors.inkPrimary,
    fontWeight: typography.fontWeight.medium,
  },
})
