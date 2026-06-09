import { useEffect } from 'react'
import {
  Easing,
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

/* ─ Constellation clocks ───────────────────────────────────────────
 *
 * Three clocks share-drive every animation:
 *   t        — 8 s loop. Star breathing, ambient bucket twinkle,
 *              centre bloom ambient pulse, completion rings. The
 *              placeholder silhouette breath also rides this clock
 *              at factor 8/5 (BaseLayer derives a 5 s wave internally),
 *              so we don't need a dedicated SharedValue for it.
 *   breathT  — 16 s loop. Drives the cascading "ripple" breath —
 *              every cycle the alpha brightens first, then each
 *              shell of connected stars ~320 ms later, until the
 *              wave has rippled through the whole figure. The rest
 *              of the time each element twinkles independently.
 *              Reinforces "the alpha is the source; everything else
 *              is its light reaching outward".
 *   driftT   — 60 s loop. Slowly translates the two nebula patches
 *              along independent vector fields so the sky feels
 *              alive without distracting. Like clouds in a long
 *              exposure — perceptible only when you stare.
 * Single-thread clocks avoid spawning a timer per element.
 *
 * REDUCED MOTION (iOS "Reducir movimiento"): when `reduce` is true we
 * NEVER start the withRepeat loops. Instead each clock is parked at a
 * sensible STATIC rest value so the whole tree that reads t/breathT/
 * driftT renders quieto pero VISIBLE — never collapsed to opacity 0:
 *   t = 0.25      → waveSV = 0.5 + 0.5·sin(0.25·2π) = 1.0 (peak). Lit
 *                   stars rest at FULL body brightness + their halos at
 *                   the high end of the ambient band; the figure reads
 *                   ENCENDIDA, not dimmed. NOTE: this parked t does NOT
 *                   by itself keep stars out of the twinkle-dip window —
 *                   `twinkleCycle = (t·2.4 + i·0.31) % 1` lands in the
 *                   dip for some indices `i`, so LitStar branches on its
 *                   own `reduce` prop to force the twinkle to full
 *                   brightness (see lit-stars.tsx `starProps`).
 *   breathT = 0.5 → bc = (0.5 − breathStart + 1) % 1 lands in
 *                   [0.51, 0.65] for every shell (breathStart ∈
 *                   [0.85, ~0.99]), all ≥ 0.1, so NO star is frozen
 *                   mid-ripple — they rest at their steady baseline.
 *   driftT = 0    → nebula / deep-field park at their home position.
 * The cancelAnimation cleanup is kept intact for both branches (a
 * reduce-motion toggle that flips back ON re-mounts the hook). The
 * components whose loops can't be derived from a static clock
 * (NextStar halo, TodayRing, LitStar twinkle) take `reduce` as a prop
 * and branch their own worklets; pure ambient (shooting stars, dust,
 * winks) is suppressed by the caller — none of that lives here.
 */

const REST_T = 0.25
const REST_BREATH_T = 0.5
const REST_DRIFT_T = 0

/* Resume a linear 0→1 wrap-clock WITHOUT a jump. A plain
 * `withRepeat(withTiming(1, dur))` started from a frozen fractional value
 * (e.g. 0.6 after a scroll-pause) wraps 1→0.6 each cycle — a discontinuity
 * that snapped the figure's breath/drift ("el emblema brinca al frenar el
 * scroll"). Instead: finish the CURRENT cycle from the frozen value to 1 at
 * the same speed (duration ∝ remaining), then reset to 0 and loop cleanly —
 * the 1→0 wrap is seamless because every consumer reads sin(v·2π), and
 * sin(2π)=sin(0). On a fresh mount (v=0) this is identical to the old loop. */
function resumeWrapClock(sv: SharedValue<number>, dur: number) {
  // 'worklet' so it's callable from BOTH the JS effect (runs on JS) and the
  // useAnimatedReaction worklet (runs on UI) without the release-APK
  // "Object is not a function" crash a plain JS helper hits inside a worklet.
  'worklet'
  const remaining = Math.max(1, (1 - sv.value) * dur)
  sv.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
    // OWN 'worklet' directive: this completion callback runs on the UI thread
    // when the segment finishes. When resumeWrapClock is called from the JS
    // effect, Reanimated does NOT auto-serialize this nested anonymous callback
    // → in a RELEASE APK it crashes "Object is not a function" the moment the
    // segment completes (dev tolerates it). The directive serializes it.
    'worklet'
    if (finished) {
      sv.value = 0
      sv.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false)
    }
  })
}

export function useConstellationClocks(
  reduce: boolean,
  /** False while the Hoy tab isn't focused. The `withRepeat` loops run on
   *  the UI thread and DON'T stop when React stops rendering off-tab — every
   *  derived worklet keeps recomputing 60×/s forever, so visiting Hoy once
   *  permanently taxes the whole app. Gating the loops on focus (park when
   *  inactive, restart when active) drops the off-tab cost to zero. INVISIBLE
   *  on-tab: while focused nothing changes. Defaults to true so callers/tests
   *  that don't pass it are unaffected. */
  active: boolean = true,
  /** SCROLL / REWARD pause, as a SharedValue (1 = paused). Driven this way —
   *  NOT as a React prop — so toggling it NEVER re-renders the constellation.
   *  A boolean prop did: every scroll start/stop and every reward re-rendered
   *  LunarConstellation, and that re-render repainted the SVG + Skia layers for
   *  a frame → "el emblema se mueve / brinca". A SharedValue keeps the prop
   *  reference stable (the memoized component doesn't re-render) and the loops
   *  pause/resume on the UI thread via the reaction below. */
  pausedSV?: SharedValue<number>,
): {
  t: SharedValue<number>
  breathT: SharedValue<number>
  driftT: SharedValue<number>
} {
  const t = useSharedValue(0)
  const breathT = useSharedValue(0)
  const driftT = useSharedValue(0)

  useEffect(() => {
    // REDUCE-MOTION → park at a lit, legible STATIC rest (the figure must read
    // encendida while perfectly still). This is the only case that WRITES the
    // REST values.
    if (reduce) {
      t.value = REST_T
      breathT.value = REST_BREATH_T
      driftT.value = REST_DRIFT_T
      return () => {
        cancelAnimation(t)
        cancelAnimation(breathT)
        cancelAnimation(driftT)
      }
    }

    // OFF-TAB (`!active`) → FREEZE the clocks at their CURRENT value (cancel,
    // no REST reset). A frozen clock is a constant → its derived worklets stop
    // recomputing (off-tab cost → 0) and it resumes seamlessly on return.
    if (!active) {
      cancelAnimation(t)
      cancelAnimation(breathT)
      cancelAnimation(driftT)
      return
    }

    // On-tab. Start the loops UNLESS a scroll/reward pause is already active
    // (the reaction below owns the dynamic pause/resume). Resume from the
    // frozen value, no wrap-jump (see resumeWrapClock).
    if (!pausedSV || pausedSV.value <= 0.5) {
      resumeWrapClock(t, 8000)
      resumeWrapClock(breathT, 16000)
      resumeWrapClock(driftT, 42000)
    }
    return () => {
      cancelAnimation(t)
      cancelAnimation(breathT)
      cancelAnimation(driftT)
    }
  }, [t, breathT, driftT, reduce, active, pausedSV])

  // Dynamic scroll/reward pause — runs ENTIRELY on the UI thread (no React
  // re-render). Freeze the clocks the instant pausedSV crosses to 1, resume
  // (no wrap-jump) when it drops back to 0. Off-tab / reduce-motion are owned
  // by the effect above, so this no-ops there.
  useAnimatedReaction(
    () => (pausedSV ? pausedSV.value > 0.5 : false),
    (paused, prev) => {
      if (reduce || !active || prev === null || paused === prev) return
      if (paused) {
        cancelAnimation(t)
        cancelAnimation(breathT)
        cancelAnimation(driftT)
      } else {
        resumeWrapClock(t, 8000)
        resumeWrapClock(breathT, 16000)
        resumeWrapClock(driftT, 42000)
      }
    },
    // pausedSV included so a future render that swaps the SharedValue ref
    // re-registers the reaction (today it's always the same stable ref).
    [reduce, active, pausedSV],
  )

  return { t, breathT, driftT }
}
