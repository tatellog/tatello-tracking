import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

/*
 * The single 0 → 1 master clock that every flash layer reads. Each
 * layer derives its own opacity / radius envelopes from this `u`, so
 * they all start, peak and settle in perfect sync.
 *
 * Duration tuned for "perceived flash + lingering afterglow": under
 * ~1.2 s the gold doesn't register; over ~2 s the wash overstays its
 * welcome and steals attention from the constellation itself.
 *
 * Re-fires whenever `celebrateKey` bumps. Cancels any in-flight
 * animation first + snaps to 0 so a fast double-commit (rare but
 * possible) doesn't mid-frame the previous flash.
 */
export const TIMELINE_MS = 1700

export function useCelebrationTimeline(celebrateKey: number): SharedValue<number> {
  const u = useSharedValue(0)

  useEffect(() => {
    if (celebrateKey === 0) return
    cancelAnimation(u)
    u.value = 0
    u.value = withTiming(1, { duration: TIMELINE_MS, easing: Easing.out(Easing.cubic) })
  }, [celebrateKey, u])

  return u
}
