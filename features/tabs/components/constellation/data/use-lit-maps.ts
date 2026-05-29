import { useMemo } from 'react'

import type { Resolved, SequenceEl } from '../types'

/* ─ Lit maps ───────────────────────────────────────────────────────
 *
 * Three derived maps that the rendering layer consults:
 *   • litKeys      — set of `${type}-${idx}` for every sequence element
 *                    already turned on.
 *   • litCluster   — centroid + bounding radius of lit STARS (drives
 *                    the warm cream-magenta aura wash), or null when
 *                    no star is lit.
 *   • starRecency  — map of lit-star idx → days since the user marked
 *                    it. Used by LitStar's halo to fade older stars
 *                    while keeping today's bright.
 */

export function useLitMaps(opts: {
  elementsLit: number
  sequence: SequenceEl[]
  trained: readonly boolean[]
  todayIdx: number
  stars: Resolved[]
}): {
  litKeys: Set<string>
  litCluster: { cx: number; cy: number; r: number; count: number } | null
  starRecency: Map<number, number>
} {
  const { elementsLit, sequence, trained, todayIdx, stars } = opts

  const litKeys = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < Math.min(elementsLit, sequence.length); i++) {
      const el = sequence[i]
      if (el) set.add(`${el.type}-${el.idx}`)
    }
    return set
  }, [elementsLit, sequence])

  // Centroid + radius of the LIT star cluster — drives a warm
  // cream-magenta wash that "bathes" the lit half of the figure
  // (LitClusterAura, rendered between FieldStars and LitLines so
  // every lit star sits inside the aura). Recomputed only when the
  // set of lit stars changes.
  const litCluster = useMemo(() => {
    const litStars: { x: number; y: number }[] = []
    for (let i = 0; i < stars.length; i++) {
      if (litKeys.has(`star-${i}`)) {
        const s = stars[i]
        if (s) litStars.push({ x: s.x, y: s.y })
      }
    }
    if (litStars.length === 0) return null
    // Centroid: simple mean of x/y.
    const cx = litStars.reduce((acc, p) => acc + p.x, 0) / litStars.length
    const cy = litStars.reduce((acc, p) => acc + p.y, 0) / litStars.length
    // Radius: max distance from centroid to any lit star, +24 padding
    // so the wash extends past the cluster edges into the surrounding
    // sky (otherwise the aura abruptly stops at the outer stars).
    const maxDist = litStars.reduce((acc, p) => Math.max(acc, Math.hypot(p.x - cx, p.y - cy)), 0)
    return { cx, cy, r: maxDist + 24, count: litStars.length }
  }, [stars, litKeys])

  // Map of lit-star idx → days since the user marked it. Reads:
  // recency 0 = today, 7 = a week ago, 27 = nearly four weeks ago.
  // Used by LitStar to scale its halo intensity — recent stars shine
  // bright, older ones taper to a quiet glow. Reinforces the app's
  // "body remembers recent rhythm more vividly than old" metaphor.
  const starRecency = useMemo(() => {
    const trainingDayIndices: number[] = []
    for (let i = 0; i <= todayIdx; i++) {
      if (trained[i]) trainingDayIndices.push(i)
    }
    const map = new Map<number, number>()
    for (let k = 0; k < Math.min(elementsLit, sequence.length); k++) {
      const el = sequence[k]
      if (el?.type !== 'star') continue
      const dayIdx = trainingDayIndices[k]
      if (dayIdx !== undefined) {
        map.set(el.idx, todayIdx - dayIdx)
      }
    }
    return map
  }, [trained, todayIdx, elementsLit, sequence])

  return { litKeys, litCluster, starRecency }
}
