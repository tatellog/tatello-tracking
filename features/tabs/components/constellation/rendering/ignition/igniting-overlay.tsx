import type { SharedValue } from 'react-native-reanimated'

import type { ZodiacDef } from '../../../../zodiac/types'
import type { Resolved } from '../../types'

import { IgnitingLine } from './igniting-line'
import { IgnitingStar } from './igniting-star'

/* ─ Igniting overlay (one-shot flashes on top) ─────────────────────
 *
 * Renders the single element currently being ignited:
 *   • star → 1 → 2.5× scale flash with overshoot, plus an emanating
 *     ring that fades as it expands.
 *   • line → SVG stroke-trace via animated strokeDashoffset.
 *
 * After the timer expires upstream, `ignitingKey` clears and the
 * regular StarsLayer / LitLines render the element in its settled
 * state, so the visual hand-off is invisible.
 */

export function IgnitingOverlay({
  zodiac,
  stars,
  ignitingKey,
  igniteT,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  ignitingKey: string | null
  igniteT: SharedValue<number>
}) {
  if (!ignitingKey) return null
  const [kind, idxStr] = ignitingKey.split('-')
  const idx = Number(idxStr)
  if (kind === 'star') {
    const s = stars[idx]
    if (!s) return null
    return <IgnitingStar s={s} igniteT={igniteT} />
  }
  if (kind === 'line') {
    const ln = zodiac.lines[idx]
    if (!ln) return null
    const A = stars[ln[0]]
    const B = stars[ln[1]]
    if (!A || !B) return null
    return <IgnitingLine A={A} B={B} igniteT={igniteT} />
  }
  return null
}
