import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { CycleRing } from '@/features/progress/components/CycleRing'
import {
  ACTIVE_CYCLE_SITUATIONS,
  cyclePhaseFromPeriod,
  type CyclePhase,
  DEFAULT_CYCLE_LENGTH,
  PHASE_LABEL,
} from '@/features/cycle/phase'
import { type CycleSituation } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

import { useLastPeriodStart } from '../hooks'

// Phase labels come from the shared PHASE_LABEL in features/cycle/phase
// (single source — the Hoy slider uses the same map).

// One read-only context line per phase (the user asked for "más
// información"). Vetted by behavioral-specialist + voice-and-copy against
// cycle-voice-spec: período/semana-antes carry the anti-culpa-de-balanza
// message (water, not fat); the calm phases speak only in POBLACIONAL,
// conditional voice ("a algunas", "muchas") — never "tu energía/tu cuerpo"
// about a suggestible state, to avoid a nocebo / horoscope read. Only the
// ACTIVE phase's line shows, never all four at once.
// NOTE: do NOT add antojo/ánimo to the lútea line without re-running it
// through behavioral-specialist — it's the highest nocebo-risk phase.
const PHASE_NOTE: Record<CyclePhase, string> = {
  menstrual:
    'Estos días tu cuerpo retiene más agua. Si la balanza sube, no es grasa: es tu ciclo. No dejes que el número te diga cómo vas.',
  folicular:
    'A algunas les vuelve algo de energía por acá. Si lo sientes, es tuyo. Si no, también está bien.',
  ovulatoria: 'Es el punto medio de tu ciclo. Muchas notan más energía por estos días.',
  lutea:
    'Tu cuerpo puede retener algo de agua estos días. Es normal y se va. No dejes que el número te diga cómo vas.',
}

/* ─────────────────────── Component ─────────────────────── */

/**
 * Tarjeta de ciclo — visible only when the user's cycle is active
 * (menstruates / contraception / irregular). Reads the last
 * period_start from cycle_events + the cycle_length_days from the
 * profile and surfaces:
 *
 *   • Day-in-cycle (1..length)
 *   • Phase name (menstrual / folicular / ovulatoria / lútea)
 *   • Days until the next predicted period
 *   • A miniature lunar timeline with the today marker
 *
 * For users that menstruate, this is often a more predictive datum
 * than weight — they can plan training / nutrition / mood around it.
 */
export function CycleCard() {
  const router = useRouter()
  const reduce = useReducedMotion()
  const { data: profile } = useProfile()
  const { data: lastPeriod } = useLastPeriodStart()

  const cycleSituation = profile?.cycle_situation as CycleSituation | null | undefined
  const isActive =
    profile?.biological_sex !== 'male' &&
    !!cycleSituation &&
    ACTIVE_CYCLE_SITUATIONS.includes(cycleSituation)
  const cycleLength = profile?.cycle_length_days ?? DEFAULT_CYCLE_LENGTH

  const state = useMemo(() => {
    if (!isActive) return null
    const cp = cyclePhaseFromPeriod(lastPeriod, cycleLength)
    if (!cp) return null
    return {
      day: cp.day,
      length: cycleLength,
      phaseKey: cp.phase,
      daysToNext: cycleLength - cp.day + 1,
    }
  }, [isActive, lastPeriod, cycleLength])

  if (!isActive) return null

  // No period logged yet — the user picked a cycle situation in
  // onboarding but the last-period date is optional and was skipped.
  // The card is the right place to invite it (the value is visible here),
  // so it's TAPPABLE and routes straight to the cycle editor — never to a
  // dead-end "Ajustes → Mi perfil" that has no cycle field.
  if (!state) {
    return (
      <Animated.View entering={FadeIn.duration(360).delay(320)}>
        <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
          Tu ciclo
        </EyebrowLabel>
        <Pressable
          onPress={() => router.push('/onboarding/cycle?source=settings')}
          accessibilityRole="button"
          accessibilityLabel="Anclar mi última menstruación"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.emptyHint}>
            Dime tu última menstruación y Stelar marca tu día del ciclo. Toca para anclarla.
          </Text>
        </Pressable>
      </Animated.View>
    )
  }

  const phaseNote = PHASE_NOTE[state.phaseKey]
  // Estimate, never a deterministic forecast: "alrededor de" keeps it as
  // context, not a fertility/calendar countdown (cycle-voice-spec §2.1, §8).
  const nextPeriod = state.daysToNext <= 1 ? 'pronto' : `alrededor de ${state.daysToNext} días`

  return (
    <Animated.View entering={FadeIn.duration(360).delay(320)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu ciclo
      </EyebrowLabel>
      <View style={styles.card}>
        <CycleRing
          day={state.day}
          length={state.length}
          phaseKey={state.phaseKey}
          phaseLabel={PHASE_LABEL[state.phaseKey]}
          reduce={reduce}
        />
        <Text style={styles.nextPeriod}>Próximo período · {nextPeriod}</Text>
        <Text style={styles.coachLine}>{phaseNote}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  cardPressed: {
    opacity: 0.6,
  },
  // "Próximo período · en N días" — a quiet anchor below the ring, never
  // the headline. Honest projection, never a fertility/ovulation forecast.
  nextPeriod: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  // Coach line — the anti-culpa-de-balanza message. Cormorant italic (coach
  // voice), warm, only present in the two phases that move the scale.
  coachLine: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  emptyHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    paddingVertical: 8,
  },
})
