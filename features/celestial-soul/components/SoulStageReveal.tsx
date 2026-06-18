import type { SoulStage } from '@/features/celestial-soul/types'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'

import { SoulMoment } from './SoulMoment'

/*
 * Momento de revelación al cruzar de etapa (Nacimiento → … → Casi despierta).
 * Es un wrapper fino de SoulMoment con el nombre y la línea de la etapa.
 */
export function SoulStageReveal({
  sign,
  revealedIds,
  stage,
  onClose,
}: {
  sign: ZodiacSign
  revealedIds: readonly string[]
  stage: SoulStage
  onClose: () => void
}) {
  return (
    <SoulMoment
      sign={sign}
      revealedIds={revealedIds}
      eyebrow={stage.name.toUpperCase()}
      line={stage.line}
      onClose={onClose}
    />
  )
}
