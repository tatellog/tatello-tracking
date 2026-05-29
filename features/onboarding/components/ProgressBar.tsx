import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

type Props = {
  /** 1-indexed current step. */
  current: number
  /** Total steps in the flow. Drives whether we render phase mode. */
  total: number
}

/*
 * The onboarding spine is 12 steps. Showing 12 raw segments (or a
 * "1 de 12" counter) on the narrative screens reads as "you still
 * have eleven screens to go" and spikes abandonment anxiety (UX
 * audit). So for the 12-step flow we collapse the steps into a small
 * number of semantic PHASES and fill them as blocks: the user feels
 * progress by chapter, not by an endless dotted ruler.
 *
 * The mapping lives entirely inside this component. Call sites keep
 * passing `current` (1..12) + `total={12}` exactly as before — no
 * onboarding screen had to change. Any non-12 flow (e.g. the photos
 * sub-flow with total={4}) falls back to the original 1-segment-per-
 * step rendering, so nothing else regresses.
 *
 * Phases for the 12-step flow (in route order):
 *   1 · Tu intención  → welcome, que-hace            (steps 1-2)
 *   2 · Tu cuerpo      → atribución … tu-base         (steps 3-7)
 *   3 · Tu ritmo       → tu-ciclo, tu-ritmo, intención (steps 8-10)
 *   4 · Tu cielo       → notificaciones, appointment   (steps 11-12)
 * A phase boundary at step N means: steps with idx <= the phase's
 * last step belong to that phase.
 */
const PHASES_12: { lastStep: number }[] = [
  { lastStep: 2 }, // Tu intención
  { lastStep: 7 }, // Tu cuerpo
  { lastStep: 10 }, // Tu ritmo
  { lastStep: 12 }, // Tu cielo
]

/** First step (1-indexed) that belongs to each phase. */
function phaseRange(phases: { lastStep: number }[], index: number) {
  const firstStep = index === 0 ? 1 : (phases[index - 1]?.lastStep ?? 0) + 1
  const lastStep = phases[index]?.lastStep ?? firstStep
  return { firstStep, lastStep, count: lastStep - firstStep + 1 }
}

export function ProgressBar({ current, total }: Props) {
  // Phase mode only for the canonical 12-step spine. Everything else
  // keeps the original per-step segments.
  if (total !== 12) {
    return (
      <View
        style={styles.container}
        accessibilityRole="progressbar"
        accessibilityValue={{ now: current, min: 0, max: total }}
      >
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1
          const state = idx < current ? 'done' : idx === current ? 'active' : 'pending'
          return (
            <View
              key={i}
              style={[
                styles.segment,
                state === 'done' && styles.segmentDone,
                state === 'active' && styles.segmentActive,
                state === 'pending' && styles.segmentPending,
              ]}
            />
          )
        })}
      </View>
    )
  }

  const phases = PHASES_12

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      // Surface phase progress to AT, not the raw 12-count: "phase 2
      // of 4". Keeps the same calmer framing the visual gives.
      accessibilityValue={{
        now: phases.findIndex((_, i) => current <= phaseRange(phases, i).lastStep) + 1,
        min: 0,
        max: phases.length,
      }}
    >
      {phases.map((_, i) => {
        const { firstStep, lastStep, count } = phaseRange(phases, i)
        // How far the user is *within* this phase, 0..1.
        let fill = 0
        if (current > lastStep) fill = 1
        else if (current >= firstStep) {
          // Steps completed within the phase. The current step counts
          // as partially done so an active phase always shows life.
          fill = (current - firstStep + 1) / count
        }

        const isActive = current >= firstStep && current <= lastStep

        return (
          <View key={i} style={styles.phaseTrack}>
            {/* Pending base for the whole phase. */}
            <View style={[styles.phaseFill, styles.phasePending]} />
            {/* Filled portion overlaid left-aligned. */}
            {fill > 0 ? (
              <View
                style={[
                  styles.phaseFill,
                  { width: `${fill * 100}%` },
                  isActive ? styles.phaseActive : styles.phaseDone,
                ]}
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    height: 3,
    width: '100%',
  },
  // ── Per-step mode (non-12 flows) ──────────────────────────────
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 1,
  },
  segmentDone: {
    backgroundColor: colors.leche,
  },
  segmentActive: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  segmentPending: {
    backgroundColor: colors.bruma,
  },
  // ── Phase mode (12-step spine) ────────────────────────────────
  phaseTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1,
    overflow: 'hidden',
  },
  phaseFill: {
    ...StyleSheet.absoluteFillObject,
    height: 3,
    borderRadius: 1,
  },
  phasePending: {
    width: '100%',
    backgroundColor: colors.bruma,
  },
  phaseDone: {
    backgroundColor: colors.leche,
  },
  phaseActive: {
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
})
