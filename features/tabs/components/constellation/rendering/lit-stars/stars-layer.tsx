import { type SharedValue } from 'react-native-reanimated'

import type { Resolved, SequenceEl } from '../../types'

import { LitStar } from './lit-star'
import { NextStar } from './next-star'

/*
 * StarsLayer — the public dispatcher mounted by LunarConstellation.
 * For each figure star it picks ONE variant per render:
 *
 *   • ignitingKey match → null (IgnitingOverlay paints the flash on top)
 *   • next ignition slot → <NextStar /> (breathing magenta halo)
 *   • already lit       → <LitStar />  (the full multi-layer body)
 *   • unlit + not next  → null (the BaseLayer renders its placeholder)
 *
 * No animation lives here — every clock is forwarded as a prop to the
 * child that needs it. Keeping this file dispatch-only makes the
 * variant table easy to audit (one branch per visual state) and
 * isolates per-variant changes to their own file.
 */
export function StarsLayer({
  stars,
  litKeys,
  nextEl,
  t,
  ignitingKey,
  intensity,
  litPulse,
  starRecency,
  breathT,
  starDepth,
  reduce,
}: {
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  t: SharedValue<number>
  /** While set, the matching star is skipped here so IgnitingOverlay
   *  can draw its flash on top without doubling up. */
  ignitingKey: string | null
  intensity: number
  litPulse: SharedValue<number>
  /** Star idx → days since marked. Drives the halo decay so recent
   *  stars feel alive and older ones quiet down. */
  starRecency: Map<number, number>
  /** 16s coordinated-breath clock. Threaded through to LitStar so
   *  every lit star can share the same brighten window. */
  breathT: SharedValue<number>
  /** Star idx → BFS distance from the alpha through the figure
   *  graph. Each shell pulses 320 ms after the previous, so the
   *  breath ripples outward from the alpha instead of firing in
   *  unison. */
  starDepth: Map<number, number>
  /** iOS "Reducir movimiento". Passed by PROP (never read via a hook
   *  inside this .map) to the per-star loops that can't derive a
   *  static rest from the parked clocks: NextStar's breathing halo
   *  rests VISIBLE at its high end ("te espera"), TodayRing rests
   *  visible without rotating, and the rising spark particles (pure
   *  ambient) are suppressed. The star body's breath/halo rest via the
   *  parked t/breathT clocks, but its twinkle is also forced to full
   *  brightness inside the worklet (a parked t leaves some indices
   *  dimmed mid-dip). */
  reduce: boolean
}) {
  return (
    <>
      {stars.map((s, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (ignitingKey === `star-${i}`) return null
        if (isNext) return <NextStar key={`s-${i}`} s={s} t={t} reduce={reduce} />
        if (isLit) {
          const recency = starRecency.get(i) ?? 0
          const depth = starDepth.get(i) ?? 0
          return (
            <LitStar
              key={`s-${i}`}
              s={s}
              i={i}
              t={t}
              intensity={intensity}
              litPulse={litPulse}
              recency={recency}
              breathT={breathT}
              depth={depth}
              reduce={reduce}
            />
          )
        }
        return null
      })}
    </>
  )
}
