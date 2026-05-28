/*
 * Refactor safety net (Paso 3) — snapshot tests for the
 * LunarConstellation render tree.
 *
 * What this catches: structural regressions during the strangler-fig
 * refactor. With `react-native-reanimated/mock` cargado en
 * jest.setup.ts, every SharedValue + worklet is deterministic, so the
 * same input always produces the same snapshot. A mismatch means the
 * extraction changed something visible in the tree (a layer was lost,
 * a prop was renamed, a gradient ID was mistyped).
 *
 * What this DOES NOT catch: timing differences in real worklets,
 * jank/performance regressions, errors that only manifest on device.
 * See docs/refactor/safety-net.md for the full coverage map.
 *
 * Run: pnpm test -- LunarConstellation
 * Regenerate baseline: pnpm test -- LunarConstellation -u
 *   (only do this BEFORE the refactor, or when the diff is by
 *   design — never as a "shortcut" to make the test green again)
 */

import { act, render } from '@testing-library/react-native'

import { LUNAR_CONSTELLATION_STATES } from '../__fixtures__/lunar-constellation-states'
import { LunarConstellation } from '../LunarConstellation'

// Defensive mocks for native modules that may not render cleanly in
// jest. BlurView is rendered as a passthrough View — its actual blur
// shader doesn't matter for the structural diff. The SVG asset map is
// already handled by react-native-svg-transformer through jest-expo.
jest.mock('expo-blur', () => {
  const RN = jest.requireActual('react-native')
  return {
    BlurView: RN.View,
  }
})

// Hold the canvas-ready timer + ignition queue setTimeouts under our
// control so snapshots capture the post-reveal state (the live SVG,
// not the skeleton) deterministically.
jest.useFakeTimers()

describe('LunarConstellation · refactor-safety snapshots', () => {
  it.each(LUNAR_CONSTELLATION_STATES.map((s) => [s.id, s] as const))('%s', (_id, state) => {
    const { toJSON } = render(
      <LunarConstellation
        trained={state.trained}
        todayIdx={state.todayIdx}
        sign={state.sign}
        committed={state.committed}
      />,
    )
    // Advance past the 1500 ms canvas-ready hold + the 700 ms blur
    // reveal ramp so the snapshot captures the live SVG tree, not
    // the transient skeleton.
    act(() => {
      jest.advanceTimersByTime(2500)
    })
    expect(toJSON()).toMatchSnapshot()
  })
})
