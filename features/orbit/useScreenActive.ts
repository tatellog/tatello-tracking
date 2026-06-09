import { useIsFocused } from '@react-navigation/native'
import { createContext, useContext } from 'react'

/**
 * Set to `true` by a screen's ScrollView while it is actively scrolling.
 * `useScreenActive` reads it so EVERY animation loop gated on screen-active
 * also pauses during a scroll gesture — frees the UI thread so the scroll
 * stays smooth, then resumes on release. Default false (no provider → no
 * scroll-pause, behaves exactly as before).
 */
export const ScrollPauseContext = createContext(false)

/**
 * True while the screen owning this component is the focused tab/route AND
 * not mid-scroll.
 *
 * Animation loops gate on this so a tab's Reanimated clocks + Skia repaint
 * actually PAUSE when you navigate away (off-tab) or scroll. `<Freeze>` /
 * `freezeOnBlur` only suspend React renders — the `withRepeat` timers run on
 * the UI thread and keep going regardless. Gating each component's loop
 * `useEffect` on this (early-return when inactive → the cleanup cancels the
 * loops) is what truly stops the cosmos from animating off-tab / mid-scroll.
 */
export function useScreenActive(): boolean {
  const focused = useIsFocused()
  const scrollPaused = useContext(ScrollPauseContext)
  return focused && !scrollPaused
}
