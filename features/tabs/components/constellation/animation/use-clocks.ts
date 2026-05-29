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
 */

export function useConstellationClocks(): {
  t: SharedValue<number>
  breathT: SharedValue<number>
  driftT: SharedValue<number>
} {
  const t = useSharedValue(0)
  const breathT = useSharedValue(0)
  const driftT = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    breathT.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false)
    driftT.value = withRepeat(withTiming(1, { duration: 42000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(breathT)
      cancelAnimation(driftT)
    }
  }, [t, breathT, driftT])

  return { t, breathT, driftT }
}
