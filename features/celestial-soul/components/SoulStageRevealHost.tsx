import type { ZodiacSign } from '@/features/tabs/zodiac/types'

import { useSoulRevealIds, useSoulStageReveal } from '../hooks'
import { SoulStageReveal } from './SoulStageReveal'

/*
 * Pegamento sin UI propia: detecta el cruce de etapa (useSoulStageReveal) y, si
 * toca, muestra el momento de revelación con la figura en su estado actual.
 * Móntalo donde ocurren las revelaciones de nodos (Tab Hoy), con signo real.
 */
export function SoulStageRevealHost({ sign }: { sign: ZodiacSign }) {
  const { stage, dismiss } = useSoulStageReveal(sign)
  const { data: revealedIds } = useSoulRevealIds(sign)

  if (!stage) return null
  return (
    <SoulStageReveal sign={sign} revealedIds={revealedIds ?? []} stage={stage} onClose={dismiss} />
  )
}
