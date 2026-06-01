import { useEffect, useRef, useState } from 'react'
import {
  Easing,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { IGNITE_LINE_MS, IGNITE_STAR_MS, NUMBER_COUNTUP_MS } from '../constants'
import type { SequenceEl } from '../types'

/* ─ Ignition engine ────────────────────────────────────────────────
 *
 * When `elementsLit` jumps up we want each newly-lit star/line to
 * play a one-shot flash before settling into its ambient state. The
 * engine has three moving parts:
 *   1. A queue of pending SequenceEl[] additions. Pushing to it
 *      kicks the dispatch effect.
 *   2. `ignitingKey` (the key currently mid-animation). While set,
 *      the regular lit/next layers skip it and IgnitingOverlay
 *      draws the flash on top.
 *   3. `igniteT` 0→1 shared value driving the flash and the line
 *      stroke trace. Reset to 0 + withTiming each dispatch.
 *
 * The bloom burst, number pulse and count-up fire once per tap
 * (regardless of how many elements bumped), since they live in the
 * centre and shouldn't strobe.
 */

export function useIgnitionEngine(opts: {
  trainedCount: number
  elementsLit: number
  sequence: SequenceEl[]
}): {
  ignitingKey: string | null
  igniteT: SharedValue<number>
  numberPulse: SharedValue<number>
  displayedCount: SharedValue<number>
  litPulse: SharedValue<number>
  radialPulse: SharedValue<number>
  plusOne: SharedValue<number>
} {
  const { trainedCount, elementsLit, sequence } = opts

  const prevLitRef = useRef(elementsLit)
  const prevCountRef = useRef(trainedCount)

  const [ignitionQueue, setIgnitionQueue] = useState<SequenceEl[]>([])
  const [ignitingKey, setIgnitingKey] = useState<string | null>(null)

  const igniteT = useSharedValue(0)
  const numberPulse = useSharedValue(0)
  const displayedCount = useSharedValue(trainedCount)
  // 0→1→0 ripple of brightness across every star/line that is
  // already lit. Fires once per slider commit so the constellation
  // "breathes brighter" the moment the user marks the day.
  const litPulse = useSharedValue(0)
  // 0→1 radial wave that expands from the centre on each commit. Drives
  // a magenta ring expansion + a parallel placeholder-silhouette flash
  // so the WHOLE figure (lit + unlit) lights up momentarily, then
  // settles back to the current state. Shared by BaseLayer + the Órbita
  // magenta StarBurst — DO NOT re-time it here.
  const radialPulse = useSharedValue(0)
  // 0→1 ramp fired once per upward commit — drives the floating "+1"
  // ghost that rises above the counter and fades. The literal
  // increment, made visible for ~700 ms then gone (a flourish, not
  // chrome). Stays at 0 on undo / first paint.
  const plusOne = useSharedValue(0)

  // Detect upward changes → fire haptic, run centre animations, push
  // new SequenceEls onto the queue. Downward changes (undo) just sync
  // the displayed number without replaying any animation.
  useEffect(() => {
    const prevLit = prevLitRef.current
    const prevCount = prevCountRef.current
    prevLitRef.current = elementsLit
    prevCountRef.current = trainedCount

    if (trainedCount === prevCount) return

    if (trainedCount < prevCount) {
      displayedCount.value = trainedCount
      return
    }

    displayedCount.value = withTiming(trainedCount, {
      duration: NUMBER_COUNTUP_MS,
      easing: Easing.out(Easing.cubic),
    })
    numberPulse.value = 0
    numberPulse.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(0, { duration: 340, easing: Easing.inOut(Easing.cubic) }),
    )
    // The "+1" ghost — a single 0→1 ramp; the overlay derives both
    // its rise and its fade from this value.
    plusOne.value = 0
    plusOne.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) })
    litPulse.value = 0
    litPulse.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 480, easing: Easing.inOut(Easing.cubic) }),
    )
    radialPulse.value = 0
    radialPulse.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) })

    if (elementsLit > prevLit) {
      // Field stars don't run through the ignition flash — they just
      // fade in. Only figure stars/lines get the dramatic ignition.
      const newEls = sequence.slice(prevLit, elementsLit).filter((el) => el.type !== 'field')
      setIgnitionQueue((q) => [...q, ...newEls])
    }
    // The commit haptic is owned by the Hoy screen's action handlers
    // (a designed two-beat phrase) — the constellation no longer
    // fires its own single tick, which would double up.
  }, [
    trainedCount,
    elementsLit,
    sequence,
    displayedCount,
    numberPulse,
    litPulse,
    radialPulse,
    plusOne,
  ])

  // Drain the queue one element at a time. Each fire sets igniteT 0→1
  // over the element-typed duration, holds for 30ms post-completion,
  // then clears `ignitingKey` which retriggers this effect.
  useEffect(() => {
    if (ignitingKey != null || ignitionQueue.length === 0) return
    const [next, ...rest] = ignitionQueue
    if (!next) return
    setIgnitionQueue(rest)

    const key = `${next.type}-${next.idx}`
    const duration = next.type === 'line' ? IGNITE_LINE_MS : IGNITE_STAR_MS
    igniteT.value = 0
    igniteT.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    setIgnitingKey(key)

    const timer = setTimeout(() => setIgnitingKey(null), duration + 30)
    return () => clearTimeout(timer)
  }, [ignitingKey, ignitionQueue, igniteT])

  return {
    ignitingKey,
    igniteT,
    numberPulse,
    displayedCount,
    litPulse,
    radialPulse,
    plusOne,
  }
}
