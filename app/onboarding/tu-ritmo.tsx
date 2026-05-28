import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { StepHeader, Stepper, WizardLayout } from '@/features/onboarding/components'
import { type TrainingFrequency } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

const MIN_SLEEP = 3
const MAX_SLEEP = 14
const DEFAULT_SLEEP = 7

type TrainingOption = {
  value: TrainingFrequency
  label: string
  tagline: string
}

const TRAINING_OPTIONS: readonly TrainingOption[] = [
  {
    value: 'none',
    label: 'No me muevo todavía',
    tagline: 'Stelar lee tu base y te acompaña a entrar',
  },
  {
    value: 'low',
    label: '1 o 2 veces por semana',
    tagline: 'Movimiento ocasional, sin patrón fijo',
  },
  {
    value: 'mid',
    label: '3 o 4 veces por semana',
    tagline: 'Rutina sostenida con días libres',
  },
  {
    value: 'high',
    label: '5 o más veces por semana',
    tagline: 'Te mueves casi todos los días',
  },
]

/*
 * Step 8 — Tu ritmo. Asks for the user's typical sleep hours and
 * training frequency. The two baselines the Voz needs so sentences
 * like "cinco horas se notan" can land — without them Stelar can only
 * speak in averages.
 *
 * The previous version stacked two visually disconnected sections
 * (a Stepper for sleep, then a SelectableCard list for movement) with
 * different cards reading like a generic form. This version uses one
 * cohesive cosmic language: each section gets a serif-italic eyebrow,
 * the movement options use the same magenta-dot + slide-right card
 * pattern as tu-intencion, and a thin gradient hairline separates the
 * two so they read as "two pieces of one baseline" rather than two
 * forms stacked.
 */
export default function TuRitmoScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [sleep, setSleep] = useState<number>(profile?.typical_sleep_hours ?? DEFAULT_SLEEP)
  const [training, setTraining] = useState<TrainingFrequency | null>(
    (profile?.training_frequency as TrainingFrequency | null) ?? null,
  )

  // Personalised eyebrow was "Tu ritmo · {firstName}". That read as a
  // debug data-row when the name landed in caps next to the section
  // label. The screen already names itself; we drop the per-name
  // suffix for a clean eyebrow.
  const eyebrow = 'Tu ritmo'

  // Slow shared breath drives the resting state of every card's dot.
  const clock = useSharedValue(0)
  useEffect(() => {
    clock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(clock)
  }, [clock])

  const canContinue = training !== null

  const handlePickTraining = (next: TrainingFrequency) => {
    Haptics.selectionAsync().catch(() => {})
    setTraining(next)
  }

  const handleContinue = () => {
    if (!canContinue || !training) return
    updateProfile.mutate(
      {
        typical_sleep_hours: Number(sleep.toFixed(1)),
        training_frequency: training,
      },
      {
        onSuccess: () => router.push('/onboarding/tu-intencion'),
      },
    )
  }

  return (
    <WizardLayout
      step={9}
      totalSteps={12}
      canContinue={canContinue}
      loading={updateProfile.isPending}
      errorMessage={updateProfile.error?.message}
      onContinue={handleContinue}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StepHeader
          eyebrow={eyebrow}
          eyebrowColor="magenta"
          question={'¿Cómo descansas\ny te mueves?'}
          questionEmphasis="descansas"
          hint="Una foto rápida de tu base."
        />

        {/* Sleep section. */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Sueño habitual</Text>
          <Stepper
            label=""
            value={sleep}
            onChange={setSleep}
            min={MIN_SLEEP}
            max={MAX_SLEEP}
            step={0.5}
            unit="horas"
            decimals={1}
          />
          <Text style={styles.caveat}>Tu promedio, no el ideal.</Text>
        </View>

        {/* Thin gradient hairline that separates "cómo descansas"
            from "cómo te mueves" without making them feel like two
            different forms. */}
        <View style={styles.divider} />

        {/* Movement section. */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Movimiento por semana</Text>
          <View style={styles.optionsBlock}>
            {TRAINING_OPTIONS.map((opt) => {
              const selected = training === opt.value
              const isAnySelected = training !== null
              return (
                <TrainingCard
                  key={opt.value}
                  option={opt}
                  selected={selected}
                  dim={isAnySelected && !selected}
                  onPress={() => handlePickTraining(opt.value)}
                  clock={clock}
                />
              )
            })}
          </View>
        </View>
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Card ─────────────────────── */

/** A training-frequency card. Same visual contract as the
 *  IntentCard in tu-intencion so the two screens feel like one
 *  continuous wizard, not two different forms. */
function TrainingCard({
  option,
  selected,
  dim,
  onPress,
  clock,
}: {
  option: TrainingOption
  selected: boolean
  dim: boolean
  onPress: () => void
  clock: SharedValue<number>
}) {
  const scale = useSharedValue(1)
  useEffect(() => {
    scale.value = withSpring(selected ? 1.02 : 1, { damping: 16, stiffness: 220 })
  }, [selected, scale])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const textStyle = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ translateX: selected ? 4 : 0 }] }
  })

  const dotStyle = useAnimatedStyle(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const s = selected ? 1.25 : 1
    return {
      transform: [{ scale: s * (1 + b * 0.08) }],
      opacity: selected ? 1 : dim ? 0.18 : 0.42 + b * 0.12,
    }
  })

  return (
    <Animated.View style={[styles.cardOuter, cardStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityLabel={option.label}
        accessibilityState={{ selected }}
        android_ripple={{ color: 'rgba(217, 39, 102, 0.18)', borderless: false }}
        style={({ pressed }) => [pressed && styles.cardPressed]}
      >
        <View style={[styles.card, selected ? styles.cardOn : styles.cardOff]}>
          <Animated.View style={[styles.dot, selected ? styles.dotOn : styles.dotOff, dotStyle]} />
          <Animated.View style={[styles.textCol, textStyle]}>
            <Text style={[styles.label, selected && styles.labelOn]}>{option.label}</Text>
            <Text style={[styles.tagline, selected && styles.taglineOn]}>{option.tagline}</Text>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

/* ─────────────────────── Styles ─────────────────────── */

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 28,
    gap: 10,
  },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 28,
  },
  // Padding horizontal so the selected card's magenta shadow
  // (radius 14) doesn't get clipped by the ScrollView's implicit
  // overflow:hidden. Same fix pattern as tu-ciclo + cuerpo-base.
  optionsBlock: {
    gap: 10,
    paddingHorizontal: 14,
  },
  caveat: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.niebla,
    marginTop: 4,
  },
  /* Training card — mirrors the IntentCard contract from
     tu-intencion so the two screens feel continuous. */
  cardOuter: {},
  cardPressed: {
    opacity: 0.88,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardOff: {
    backgroundColor: colors.bgCard,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  cardOn: {
    backgroundColor: 'rgba(217, 39, 102, 0.12)',
    borderColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
  },
  dotOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotOn: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.bone,
    letterSpacing: -0.3,
  },
  labelOn: {
    color: colors.leche,
  },
  tagline: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 15,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  taglineOn: {
    color: '#F4ABC8',
  },
})
