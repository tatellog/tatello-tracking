import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import {
  ACTIVE_CYCLE_SITUATIONS,
  cyclePhaseFromPeriod,
  type CyclePhase,
  DEFAULT_CYCLE_LENGTH,
} from '@/features/cycle/phase'
import { type CycleSituation } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

import { useLastPeriodStart } from '../hooks'

// Spanish display label for each phase key.
const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  folicular: 'Folicular',
  ovulatoria: 'Ovulatoria',
  lutea: 'Lútea',
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
  const { data: profile } = useProfile()
  const { data: lastPeriod } = useLastPeriodStart()

  const cycleSituation = profile?.cycle_situation as CycleSituation | null | undefined
  const isActive = !!cycleSituation && ACTIVE_CYCLE_SITUATIONS.includes(cycleSituation)
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

  // No period logged yet — quiet placeholder; the user added the
  // cycle situation in onboarding but hasn't anchored it with a date.
  if (!state) {
    return (
      <Animated.View entering={FadeIn.duration(360).delay(320)}>
        <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
          Tu ciclo
        </EyebrowLabel>
        <View style={styles.card}>
          <Text style={styles.emptyHint}>
            Anclá tu última menstruación en Ajustes → Mi perfil para que Stelar marque tu día del
            ciclo.
          </Text>
        </View>
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(360).delay(320)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tu ciclo
      </EyebrowLabel>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View>
            <Text style={styles.dayNum}>Día {state.day}</Text>
            <Text style={styles.phaseLabel}>{PHASE_LABEL[state.phaseKey]}</Text>
          </View>
          <View style={styles.headRight}>
            <Text style={styles.headRightLabel}>Próximo período</Text>
            <Text style={styles.headRightValue}>
              {state.daysToNext <= 1 ? 'mañana' : `en ${state.daysToNext} días`}
            </Text>
          </View>
        </View>

        <Timeline day={state.day} length={state.length} phaseKey={state.phaseKey} />
      </View>
    </Animated.View>
  )
}

/* Mini timeline — a horizontal track with a marker at today's day +
 * coloured bands for each phase. The whole length spans the full
 * cycle (`length` days) so a quick glance shows how far through the
 * arc the user is. */
function Timeline({
  day,
  length,
  phaseKey,
}: {
  day: number
  length: number
  phaseKey: CyclePhase
}) {
  const W = 340
  const H = 28
  const padX = 6
  const trackY = H / 2

  // Phase boundaries (in days).
  const menstrualEnd = 5
  const ovStart = Math.floor(length / 2) - 2
  const ovEnd = ovStart + 4

  const x = (d: number) => padX + ((d - 1) / (length - 1)) * (W - 2 * padX)

  const xToday = x(day)

  // Highlight band for the current phase, dim band for everything else.
  const phaseRange = (() => {
    if (phaseKey === 'menstrual') return [1, menstrualEnd]
    if (phaseKey === 'folicular') return [menstrualEnd + 1, ovStart - 1]
    if (phaseKey === 'ovulatoria') return [ovStart, ovEnd]
    return [ovEnd + 1, length]
  })()

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Base track — quiet hairline across the whole cycle. */}
      <Line
        x1={padX}
        y1={trackY}
        x2={W - padX}
        y2={trackY}
        stroke="#FFFFFF"
        strokeOpacity={0.1}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* Current phase highlight band. */}
      <Line
        x1={x(phaseRange[0]!)}
        y1={trackY}
        x2={x(phaseRange[1]!)}
        y2={trackY}
        stroke={colors.magenta}
        strokeOpacity={0.55}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* Today marker — a luminous dot with bloom. */}
      <Circle cx={xToday} cy={trackY} r={9} fill={colors.magenta} opacity={0.18} />
      <Circle cx={xToday} cy={trackY} r={5} fill={colors.magenta} />
      <Circle cx={xToday} cy={trackY} r={2} fill="#FFFFFF" opacity={0.95} />
    </Svg>
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
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dayNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 26,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  phaseLabel: {
    marginTop: 2,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.magenta,
    letterSpacing: -0.2,
  },
  headRight: {
    alignItems: 'flex-end',
  },
  headRightLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: colors.niebla,
    textTransform: 'uppercase',
  },
  headRightValue: {
    marginTop: 4,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.bone,
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
