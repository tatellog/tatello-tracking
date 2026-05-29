import { useMemo } from 'react'

import type { ZodiacDef } from '../../../zodiac/types'
import { H, W } from '../constants'
import type { Resolved } from '../types'

/* ─ Figure geometry ────────────────────────────────────────────────
 *
 * Pure geometric derivations from the resolved stars + zodiac.lines:
 *   • alphaIdx   — index of the brightest (lowest mag) star.
 *   • alphaPos   — (x, y) of that star, or canvas centre if absent.
 *   • starDepth  — BFS distance from alpha through the figure graph.
 *   • lineDepth  — for each line, the closer of its two endpoints'
 *                  starDepth values.
 *
 * Drives nebula bias toward the alpha quadrant, the cascading "breath"
 * ripple that radiates outward from the alpha, and the line-by-line
 * lighting cadence that follows.
 */

export function useFigureGeometry(
  zodiac: ZodiacDef,
  stars: Resolved[],
): {
  alphaIdx: number
  alphaPos: { x: number; y: number }
  starDepth: Map<number, number>
  lineDepth: number[]
} {
  // The figure's "alpha" — the star with the lowest magnitude. Used
  // to bias the nebula toward the alpha's quadrant so the sky has
  // directionality: the warm patch sits where the brightest star
  // radiates, the cool patch sits in the opposite quadrant. Without
  // this the canvas reads as a flat magenta wash; with it the
  // constellation feels placed somewhere specific in space.
  const alphaIdx = useMemo(() => {
    let minMag = Infinity
    let idx = 0
    for (let i = 0; i < stars.length; i++) {
      if (stars[i]!.mag < minMag) {
        minMag = stars[i]!.mag
        idx = i
      }
    }
    return idx
  }, [stars])

  const alphaPos = useMemo(() => {
    const a = stars[alphaIdx]
    return a ? { x: a.x, y: a.y } : { x: W / 2, y: H / 2 }
  }, [stars, alphaIdx])

  // BFS distance map from the alpha through the figure's line graph.
  // Drives the cascading "ripple" breath: the alpha pulses first, then
  // each shell of connected stars ~320 ms later. The constellation
  // feels like a neural network firing outward from a source instead
  // of a chorus chanting in unison — narrative weight on the alpha as
  // origin, with the rest of the figure responding to it.
  const starDepth = useMemo(() => {
    const adj: number[][] = stars.map(() => [])
    for (const [a, b] of zodiac.lines) {
      adj[a]?.push(b)
      adj[b]?.push(a)
    }
    const depth = new Map<number, number>()
    depth.set(alphaIdx, 0)
    const queue: number[] = [alphaIdx]
    while (queue.length > 0) {
      const u = queue.shift()!
      const d = depth.get(u) ?? 0
      for (const v of adj[u] ?? []) {
        if (depth.has(v)) continue
        depth.set(v, d + 1)
        queue.push(v)
      }
    }
    return depth
  }, [stars, zodiac.lines, alphaIdx])

  // Line depth = whichever of its endpoints is closer to the alpha.
  // A line lights up in sync with its nearest-to-alpha endpoint so
  // the wave radiates through stars and lines together.
  const lineDepth = useMemo(
    () =>
      zodiac.lines.map(([a, b]) => {
        const da = starDepth.get(a) ?? 0
        const db = starDepth.get(b) ?? 0
        return Math.min(da, db)
      }),
    [zodiac.lines, starDepth],
  )

  return { alphaIdx, alphaPos, starDepth, lineDepth }
}
