import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors } from '@/theme'

import {
  useSoulFinalReveal,
  useSoulRegionReveal,
  useSoulRevealIds,
  useSoulStageReveal,
} from '../hooks'
import { RegionIcon } from './RegionIcon'
import { SoulMoment } from './SoulMoment'
import { SoulStageReveal } from './SoulStageReveal'

/*
 * Pegamento sin UI propia: orquesta TODOS los momentos del Alma Celeste y
 * muestra UNO a la vez por prioridad — región al 100% > final (las 6) > cruce
 * de etapa. Cada hook persiste su propio "ya visto"; al cerrar el de mayor
 * prioridad, el siguiente pendiente aparece. Móntalo en Tab Hoy (tras la
 * ceremonia), con signo real.
 */
export function SoulMomentHost({ sign }: { sign: ZodiacSign }) {
  const { data: revealedIds } = useSoulRevealIds(sign)
  const region = useSoulRegionReveal(sign)
  const final = useSoulFinalReveal(sign)
  const stage = useSoulStageReveal(sign)
  const ids = revealedIds ?? []

  if (region.region) {
    return (
      <SoulMoment
        sign={sign}
        revealedIds={ids}
        icon={<RegionIcon region={region.region.key} size={30} color={colors.oro} />}
        eyebrow={region.region.label.toUpperCase()}
        line={region.region.revelation.line}
        onClose={region.dismiss}
      />
    )
  }
  if (final.show) {
    return (
      <SoulMoment
        sign={sign}
        revealedIds={ids}
        eyebrow="TU ALMA CELESTE"
        line="Ha despertado."
        onClose={final.dismiss}
      />
    )
  }
  if (stage.stage) {
    return (
      <SoulStageReveal sign={sign} revealedIds={ids} stage={stage.stage} onClose={stage.dismiss} />
    )
  }
  return null
}
