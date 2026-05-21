import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'

import { StepHeader, WizardLayout } from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const MIN_AGE_YEARS = 13
const MAX_AGE_YEARS = 100
const DEFAULT_AGE_YEARS = 30

const SPANISH_MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/*
 * Identidad — Screen 1 of the split "Cuéntame de ti" pair. Asks only
 * the two questions that name *who* the user is: their name and the
 * date that defines their constellation. Body-base questions (height,
 * sex) live in the second screen, cuerpo-base.
 *
 * Visual language is calmer than the previous combined form: no
 * presence-star glyphs on the left (those read as form-language), no
 * gradient underline — just a magenta hairline that appears under a
 * field when it's focused or filled. Question labels sit above each
 * input in DM-equivalent serif italic at quiet opacity, so the field
 * value is the only voice that lifts off the page.
 */
export default function AboutYouScreen() {
  const router = useRouter()
  // Opened from Ajustes (?source=settings) → save and return there;
  // otherwise this is the onboarding wizard → advance to cuerpo-base.
  const { source } = useLocalSearchParams<{ source?: string }>()
  const fromSettings = source === 'settings'
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const { defaultDate, minDate, maxDate } = useMemo(() => boundsForAdult(), [])

  const initialDob = useMemo(() => parseISODate(profile?.date_of_birth), [profile?.date_of_birth])

  const [name, setName] = useState(profile?.display_name ?? '')
  const [dob, setDob] = useState<Date | null>(initialDob)

  const trimmedName = name.trim()
  const nameValid = trimmedName.length >= 1 && trimmedName.length <= 40
  const dobValid = dob !== null && isAdultAge(dob)

  const canContinue = nameValid && dobValid

  const handleContinue = () => {
    if (!canContinue || !dob) return
    updateProfile.mutate(
      {
        display_name: trimmedName,
        date_of_birth: toISODate(dob),
      },
      {
        onSuccess: () => (fromSettings ? router.back() : router.push('/onboarding/cuerpo-base')),
      },
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={4}
        totalSteps={12}
        canContinue={canContinue}
        loading={updateProfile.isPending}
        errorMessage={updateProfile.error?.message}
        onContinue={handleContinue}
        continueLabel="Continuar"
        ctaPill
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
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

          <Section question="¿cómo te llamas?">
            <LineInput
              value={name}
              onChangeText={setName}
              placeholder="Anahí"
              filled={nameValid}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
            />
          </Section>

          <Section question="¿cuándo naciste?" hint="Tu fecha define tu constelación.">
            <DateTrigger
              value={dob}
              onChange={setDob}
              filled={dobValid}
              defaultDate={defaultDate}
              minDate={minDate}
              maxDate={maxDate}
            />
          </Section>
        </ScrollView>
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

/* ─────────────────────── Section ─────────────────────── */

/** A field block: a serif-italic question label above its input. No
 *  presence glyph on the left — the question carries itself, and the
 *  input is the only thing that lights when answered. */
function Section({
  question,
  hint,
  children,
}: {
  question: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{question}</Text>
      <View style={styles.sectionBody}>{children}</View>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  )
}

/* ─────────────────────── LineInput ─────────────────────── */

/** A single-line text input. The underline only appears when the
 *  field is focused or filled — empty/idle inputs read as quiet
 *  invitations, not blank form fields. */
function LineInput({
  value,
  onChangeText,
  placeholder,
  filled,
  ...rest
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  filled: boolean
} & Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'placeholder' | 'placeholderTextColor' | 'style'
>) {
  const [focused, setFocused] = useState(false)
  const showBorder = focused || filled

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.18)"
        selectionColor={colors.magenta}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
        {...rest}
      />
      <View style={[styles.border, showBorder && styles.borderActive]} />
    </View>
  )
}

/* ─────────────────────── DateTrigger ─────────────────────── */

/** A pressable that opens the native date picker. Visual shell
 *  mirrors LineInput — same 28 px Hanken value, same active border. */
function DateTrigger({
  value,
  onChange,
  filled,
  defaultDate,
  minDate,
  maxDate,
}: {
  value: Date | null
  onChange: (next: Date) => void
  filled: boolean
  defaultDate?: Date
  minDate?: Date
  maxDate?: Date
}) {
  const [showPicker, setShowPicker] = useState(false)
  const seed = value ?? defaultDate ?? new Date(2000, 0, 1)
  const showBorder = showPicker || filled

  const handleNativeChange = (_event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (next) onChange(next)
  }

  return (
    <View>
      <Pressable
        onPress={() => setShowPicker((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel="Elegir fecha de nacimiento"
        style={styles.dateTrigger}
      >
        <Text style={[styles.input, !value && styles.inputPlaceholder]}>
          {value ? formatDateLong(value) : 'Toca para elegir'}
        </Text>
      </Pressable>
      <View style={[styles.border, showBorder && styles.borderActive]} />
      {showPicker ? (
        <DateTimePicker
          value={seed}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handleNativeChange}
          textColor={colors.leche}
          themeVariant="dark"
          style={styles.picker}
        />
      ) : null}
    </View>
  )
}

/* ─────────────────────── Date helpers ─────────────────────── */

function formatDateLong(d: Date): string {
  const month = SPANISH_MONTHS[d.getMonth()] ?? 'ene'
  return `${d.getDate()} ${month} ${d.getFullYear()}`
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

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // Generous vertical breathing between the two questions — the spec
  // calls for ~40 px so the screen never feels like a form.
  section: {
    marginTop: 40,
  },
  // The question itself — serif italic, ~20 px, soft opacity. No
  // glyph on the left; the typography is the whole signal.
  sectionLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 26,
    color: colors.leche,
    opacity: 0.55,
    letterSpacing: -0.2,
  },
  sectionBody: {
    marginTop: 12,
  },
  sectionHint: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.niebla,
    letterSpacing: 0.1,
  },
  /* Input — large value typography. */
  input: {
    paddingTop: 6,
    paddingBottom: 10,
    fontFamily: typography.uiBold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: colors.leche,
    backgroundColor: 'transparent',
  },
  inputPlaceholder: {
    color: 'rgba(255,255,255,0.32)',
  },
  inputWeb: {
    // @ts-expect-error — outline* is web-only; RNW accepts it.
    outlineStyle: 'none',
  },
  /* Date trigger — same visual shell as LineInput. */
  dateTrigger: {
    minHeight: 44,
    justifyContent: 'center',
  },
  picker: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  /* Border — a single magenta hairline that only renders when the
     field is focused or filled. Idle fields show no border so the
     screen reads as conversation, not a form. */
  border: {
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  borderActive: {
    backgroundColor: colors.magenta,
  },
})
