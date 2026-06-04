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
 * layer derives its own opacity envelope from this `u`, so they all
 * start, peak and settle in perfect sync.
 *
 * Duration matches the Home Lottie `gold-fireworks` playback length:
 * native 100 frames at 60 fps = 1.667 s, played at speed 0.6 in the
 * Home celebration = 1.667 / 0.6 ≈ 2.8 s. Syncing the wash to the
 * Lottie means the gold fades out exactly as the last particles
 * settle — no "wash ends, particles keep going" gap.
 *
 * Re-fires whenever `celebrateKey` bumps. Cancels any in-flight
 * animation first + snaps to 0 so a fast double-commit (rare but
 * possible) doesn't mid-frame the previous flash.
 */
export const TIMELINE_MS = 2800

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
