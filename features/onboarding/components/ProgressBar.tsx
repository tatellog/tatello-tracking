import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

type Props = {
  /** 1-indexed current step within the wizard's visible spine. */
  current: number
  /** Total steps in the flow. When it matches the onboarding spine
   *  (`ONBOARDING_SPINE_STEPS`) we render PHASE mode; any other value
   *  (e.g. the photos sub-flow with total={4}) falls back to one
   *  segment per step. */
  total: number
}

/*
 * The onboarding spine that carries a progress bar is 9 visible steps
 * (welcome → rhythm). Showing 9 raw segments (or a "1 de 9" counter)
 * on those screens reads as "you still have eight screens to go" and
 * spikes abandonment anxiety (UX audit). Worse, a 9-of-9 ruler reaches
 * "full" the moment the user finishes rhythm — i.e. BEFORE the "Tu
 * cielo" ceremony (reading → reveal), so it lies: it says "terminaste"
 * right before the emotional peak.
 *
 * So for the spine we collapse the steps into a small number of
 * semantic PHASES and fill them as blocks: the user feels progress by
 * chapter, not by an endless dotted ruler. Crucially we include a
 * fourth phase — "Tu cielo", the ceremony — which stays PENDING the
 * whole time the bar is on screen. The ceremony screens themselves
 * (reading / reveal / post-reveal) render NO bar (WizardLayout
 * showProgress=false), so the user crosses into "Tu cielo" exactly when
 * the bar disappears. Net effect: the last thing the bar ever shows is
 * "3 of 4 phases, Tu cielo still ahead" — never a premature "9/9 = done".
 *
 * Route order of the visible spine (1-indexed `current`):
 *   1 · Tu intención  → welcome, what-it-does, intention   (steps 1-3)
 *   2 · Tu cuerpo      → about-you, body-base, weight,
 *                        baseline                            (steps 4-7)
 *   3 · Tu ritmo       → cycle, rhythm                (steps 8-9)
 *   4 · Tu cielo       → la ceremonia (reading → reveal →   (no bar;
 *                        post-reveal)                         always pending)
 *
 * A phase's `lastStep` is the last 1-indexed spine step that belongs to
 * it. "Tu cielo" has no spine step (it's beyond `current`'s range), so
 * its `lastStep` sits past the spine and it can never fill while the
 * bar is mounted.
 */

/** Visible spine length (welcome → rhythm). Drives phase mode. */
export const ONBOARDING_SPINE_STEPS = 9

type Phase = { label: string; lastStep: number }

const ONBOARDING_PHASES: Phase[] = [
  { label: 'Tu intención', lastStep: 3 }, // welcome, what-it-does, intention
  { label: 'Tu cuerpo', lastStep: 7 }, // about-you, body-base, weight, baseline
  { label: 'Tu ritmo', lastStep: 9 }, // cycle, rhythm
  // "Tu cielo" — the ceremony. lastStep is past the spine so it stays
  // pending the entire time the bar is rendered; the ceremony screens
  // hide the bar entirely. Keeps the bar from ever reading "done".
  { label: 'Tu cielo', lastStep: ONBOARDING_SPINE_STEPS + 1 },
]

/** First step (1-indexed) that belongs to each phase. */
function phaseRange(phases: Phase[], index: number) {
  const firstStep = index === 0 ? 1 : (phases[index - 1]?.lastStep ?? 0) + 1
  const lastStep = phases[index]?.lastStep ?? firstStep
  return { firstStep, lastStep, count: lastStep - firstStep + 1 }
}

export function ProgressBar({ current, total }: Props) {
  // Phase mode only for the canonical onboarding spine. Everything else
  // (e.g. the photos sub-flow, total={4}) keeps per-step segments.
  if (total !== ONBOARDING_SPINE_STEPS) {
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

  const phases = ONBOARDING_PHASES
  const activePhase = phases.findIndex((_, i) => current <= phaseRange(phases, i).lastStep) + 1

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      // Surface phase progress to AT, not the raw step count: "phase 2
      // of 4". Keeps the calmer framing the visual gives.
      accessibilityValue={{ now: activePhase, min: 0, max: phases.length }}
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
  // ── Per-step mode (non-spine flows, e.g. photos) ──────────────
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
  // ── Phase mode (onboarding spine) ─────────────────────────────
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
