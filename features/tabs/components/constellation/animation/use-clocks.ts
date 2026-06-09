import { useEffect } from 'react'
import {
  Easing,
  cancelAnimation,
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
): {
  t: SharedValue<number>
  breathT: SharedValue<number>
  driftT: SharedValue<number>
} {
  const t = useSharedValue(0)
  const breathT = useSharedValue(0)
  const driftT = useSharedValue(0)

  useEffect(() => {
    // Reduce-motion OR off-tab → no loops. Reduce parks at a lit, legible
    // rest; off-tab parks too (the screen isn't visible) and the loops
    // restart when `active` flips back on.
    if (reduce || !active) {
      t.value = REST_T
      breathT.value = REST_BREATH_T
      driftT.value = REST_DRIFT_T
      return () => {
        cancelAnimation(t)
        cancelAnimation(breathT)
        cancelAnimation(driftT)
      }
    }

    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    breathT.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false)
    driftT.value = withRepeat(withTiming(1, { duration: 42000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(breathT)
      cancelAnimation(driftT)
    }
  }, [t, breathT, driftT, reduce, active])

  return { t, breathT, driftT }
}
