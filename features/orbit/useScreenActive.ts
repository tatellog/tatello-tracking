import { useIsFocused } from '@react-navigation/native'

/**
 * True while the screen owning this component is the focused tab/route.
 *
 * Animation loops gate on this so a tab's Reanimated clocks + Skia repaint
 * actually PAUSE when you navigate away. `<Freeze>` / `freezeOnBlur` only
 * suspend React renders — the `withRepeat` timers run on the UI thread and
 * keep going regardless. Gating each component's loop `useEffect` on this
 * (early-return when inactive → the cleanup cancels the loops) is what truly
 * stops the cosmos from animating off-tab.
 */
export function useScreenActive(): boolean {
  return useIsFocused()
}
