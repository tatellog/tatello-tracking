import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { DateField, StepHeader, Stepper, WizardLayout } from '@/features/onboarding/components'
import { type CycleSituation } from '@/features/profile/api'
import { useProfile, useRecordLastPeriodStart, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

type CycleOption = {
  value: CycleSituation
  label: string
  description: string
  /** When true, hide the period + length inputs — those questions
   *  don't apply to this situation. */
  hidesCycleInputs: boolean
}

// Five real situations rendered as cards. "skip" lives as a tertiary
// text-link below so the screen doesn't read as 6 equal options when
// one is an opt-out.
const SITUATION_OPTIONS: readonly CycleOption[] = [
  {
    value: 'menstruates',
    label: 'Tengo ciclo menstrual',
    description: 'Más o menos regular cada mes',
    hidesCycleInputs: false,
  },
  {
    value: 'contraception',
    label: 'Tomo anticonceptivo',
    description: 'Píldora, parche, inyección, DIU hormonal',
    hidesCycleInputs: false,
  },
  {
    value: 'irregular',
    label: 'Mi ciclo es irregular',
    description: 'Sangrado o ausencia sin patrón claro',
    hidesCycleInputs: false,
  },
  {
    value: 'pregnant',
    label: 'Estoy embarazada',
    description: 'Stelar pausa el track de ciclo',
    hidesCycleInputs: true,
  },
  {
    value: 'postmenopause',
    label: 'No menstrúo · menopausia',
    description: 'Stelar lee tu cuerpo sin la pieza ciclo',
    hidesCycleInputs: true,
  },
]

const MIN_CYCLE_LENGTH = 21
const MAX_CYCLE_LENGTH = 45
const DEFAULT_CYCLE_LENGTH = 28
const PERIOD_WINDOW_DAYS = 60

/*
 * Step 7 — Tu ciclo. Asks for the user's cycle situation first; only
 * surfaces the last-period date + cycle length when the situation
 * implies an active cycle (menstruates, contraception, irregular).
 *
 * Visual upgrades over the previous version (which read as saturated
 * with 6 stacked SelectableCards + two input sections + two caveats):
 *   • Local CycleCard with lighter borders + tighter padding so 5
 *     cards take ~80 px less than the 6 SelectableCards did.
 *   • "Prefiero no decir" moves out of the card list and becomes a
 *     small text-link below — opt-out, not a 6th option.
 *   • Hairline divider between the cards and the cycle-active inputs
 *     so the two zones read as separate without taking extra space.
 *   • Caveats tightened, voseo corrected to MX Spanish.
 */
export default function TuCicloScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const recordPeriod = useRecordLastPeriodStart()

  const [situation, setSituation] = useState<CycleSituation | null>(
    (profile?.cycle_situation as CycleSituation | null) ?? null,
  )
  const [lastPeriod, setLastPeriod] = useState<Date | null>(null)
  const [cycleLength, setCycleLength] = useState<number>(
    profile?.cycle_length_days ?? DEFAULT_CYCLE_LENGTH,
  )
  const [saving, setSaving] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

  const situationMeta =
    SITUATION_OPTIONS.find((o) => o.value === situation) ??
    (situation === 'skip'
      ? { value: 'skip' as const, label: '', description: '', hidesCycleInputs: true }
      : null)
  const askCycleInputs = situationMeta !== null && !situationMeta.hidesCycleInputs

  // Period picker bounds — last 60 days. A first period that long
  // ago would already mean an irregular cycle.
  const { defaultDate, minDate, maxDate } = useMemo(() => {
    const today = new Date()
    const min = new Date(today)
    min.setDate(today.getDate() - PERIOD_WINDOW_DAYS)
    const def = new Date(today)
    def.setDate(today.getDate() - 14)
    return { defaultDate: def, minDate: min, maxDate: today }
  }, [])

  const canContinue = situation !== null && (askCycleInputs ? lastPeriod !== null : true)

  const handlePick = (next: CycleSituation) => {
    Haptics.selectionAsync().catch(() => {})
    setSituation(next)
  }

  const handleContinue = async () => {
    if (!canContinue || !situation) return
    setSavingError(null)
    setSaving(true)
    try {
      await updateProfile.mutateAsync({
        cycle_situation: situation,
        ...(askCycleInputs ? { cycle_length_days: cycleLength } : {}),
      })
      if (askCycleInputs && lastPeriod) {
        await recordPeriod.mutateAsync(toISODate(lastPeriod))
      }
      router.push('/onboarding/tu-ritmo')
    } catch (e) {
      setSavingError(e instanceof Error ? e.message : 'No pudimos guardar tu ciclo.')
    } finally {
      setSaving(false)
    }
  }

  const skipSelected = situation === 'skip'

  return (
    <WizardLayout
      step={8}
      totalSteps={12}
      canContinue={canContinue}
      loading={saving}
      errorMessage={savingError}
      onContinue={handleContinue}
    >
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow="Tu ciclo"
          eyebrowColor="magenta"
          question="¿Cómo trabaja tu cuerpo?"
          questionEmphasis="trabaja"
          hint="Stelar lee tu ciclo cuando lo hay. Si no, lee el resto igual."
        />

        <View style={styles.optionsBlock}>
          {SITUATION_OPTIONS.map((opt) => (
            <CycleCard
              key={opt.value}
              option={opt}
              selected={situation === opt.value}
              onPress={() => handlePick(opt.value)}
            />
          ))}

          {/* Prefiero no decir — opt-out as a quiet text-link below the
              real options. */}
          <Pressable
            onPress={() => handlePick('skip')}
            style={styles.skipRow}
            accessibilityRole="button"
            accessibilityLabel="Prefiero no decir"
            accessibilityState={{ selected: skipSelected }}
          >
            <View style={[styles.skipDot, skipSelected && styles.skipDotOn]} />
            <Text style={[styles.skipLabel, skipSelected && styles.skipLabelOn]}>
              Prefiero no decir
            </Text>
          </Pressable>
        </View>

        {askCycleInputs ? (
          <>
            <View style={styles.divider} />
            <View style={styles.cycleBlock}>
              <View style={styles.field}>
                <DateField
                  label="ÚLTIMA MENSTRUACIÓN"
                  value={lastPeriod}
                  onChange={setLastPeriod}
                  defaultDate={defaultDate}
                  minDate={minDate}
                  maxDate={maxDate}
                  placeholder="Tocar para elegir"
                />
                <Text style={styles.caveat}>
                  Si no recuerdas exacto, una aproximación está bien.
                </Text>
              </View>

              <View style={styles.field}>
                <Stepper
                  label="DURACIÓN DEL CICLO"
                  value={cycleLength}
                  onChange={setCycleLength}
                  min={MIN_CYCLE_LENGTH}
                  max={MAX_CYCLE_LENGTH}
                  step={1}
                  unit="días"
                />
                <Text style={styles.caveat}>
                  Entre 21 y 45 días. Si no estás segura, 28 es el promedio.
                </Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Card ─────────────────────── */

/** A leaner card than the shared SelectableCard — same magenta-tint
 *  selected state but with much lighter idle treatment (no solid
 *  background, near-transparent border, tighter padding) so the
 *  stack of 5 doesn't feel saturated. */
function CycleCard({
  option,
  selected,
  onPress,
}: {
  option: CycleOption
  selected: boolean
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.015 : 1, { damping: 18, stiffness: 220 })
  }, [selected, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        accessibilityState={{ selected }}
        android_ripple={{ color: 'rgba(217, 39, 102, 0.14)', borderless: false }}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <View style={[styles.card, selected ? styles.cardOn : styles.cardOff]}>
          <Text style={[styles.cardLabel, selected && styles.cardLabelOn]}>{option.label}</Text>
          <Text style={[styles.cardDescription, selected && styles.cardDescriptionOn]}>
            {option.description}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  // Padding horizontal so the selected card's magenta shadow
  // (radius 12) doesn't get clipped by the ScrollView's implicit
  // overflow:hidden. Same fix pattern as the sex pills in cuerpo-base.
  optionsBlock: {
    marginTop: 18,
    gap: 8,
    paddingHorizontal: 14,
  },
  /* CycleCard — much lighter than the shared SelectableCard. */
  cardPressed: {
    opacity: 0.85,
  },
  card: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardOff: {
    // Solid bg so the cosmic backdrop (stars + nebula) doesn't bleed
    // through and make the cards read as floaty text instead of
    // containers. Border slightly more visible so cards have a clean
    // edge against the dark page.
    backgroundColor: colors.bgCard,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  cardOn: {
    backgroundColor: 'rgba(217, 39, 102, 0.10)',
    borderColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  cardLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    letterSpacing: -0.1,
  },
  cardLabelOn: {
    color: colors.leche,
  },
  cardDescription: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 16,
    color: colors.niebla,
    letterSpacing: 0.1,
  },
  cardDescriptionOn: {
    color: colors.bone,
  },
  /* Opt-out as a tertiary text-link, not a 6th equal-weight option. */
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 6,
    gap: 10,
  },
  skipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipDotOn: {
    backgroundColor: colors.magenta,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowColor: colors.magenta,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  skipLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  skipLabelOn: {
    color: colors.leche,
  },
  /* Hairline divider between cards and cycle-active inputs. */
  divider: {
    height: 1,
    marginTop: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  cycleBlock: {
    marginTop: 22,
    gap: 24,
    paddingBottom: 24,
  },
  field: {
    gap: 10,
  },
  caveat: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
  },
})
