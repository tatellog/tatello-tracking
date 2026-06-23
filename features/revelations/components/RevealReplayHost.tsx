import { useEffect, useState } from 'react'

import { useProfile } from '@/features/profile/hooks'
import { useTransformProgress } from '@/features/emblem'
import { PatternReveal } from '@/features/patterns'
import type { PatternType } from '@/features/patterns/logic'
import { zodiacFromDate } from '@/features/tabs/zodiac'

import { TransformationReveal } from './TransformationReveal'
import { subscribeReplayReveal, type ReplayEvent } from '../replay-bus'

/*
 * Host de "re-vivir" una revelación. Se monta en la RAÍZ de una pantalla (Hoy,
 * Progreso) — las ceremonias son `absoluteFill`, así que solo cubren todo si
 * viven en la raíz. Escucha el bus (emitReplayReveal) que dispara el detalle de
 * un día al tocar su evento, y re-abre la MISMA ceremonia full-screen:
 *   · transformation → emblema al umbral
 *   · return         → emblema con variante de regreso
 *   · pattern        → constelación del patrón
 * Self-contained: resuelve signo + progreso por su cuenta; la pantalla solo lo
 * monta una vez, sin props.
 */
export function RevealReplayHost() {
  const { data: profile } = useProfile()
  const sign = zodiacFromDate(profile?.date_of_birth)
  const { progress } = useTransformProgress()
  const [replay, setReplay] = useState<ReplayEvent | null>(null)

  useEffect(() => subscribeReplayReveal(setReplay), [])

  if (!replay) return null
  const close = () => setReplay(null)

  if (replay.tier === 'transformation') {
    return (
      <TransformationReveal
        sign={sign}
        threshold={Number(replay.kind)}
        message={replay.message}
        onClose={close}
      />
    )
  }
  if (replay.tier === 'return') {
    return (
      <TransformationReveal
        sign={sign}
        variant="return"
        threshold={progress}
        message={replay.message}
        onClose={close}
      />
    )
  }
  return (
    <PatternReveal
      pattern={{ id: 'replay', type: replay.kind as PatternType, message: replay.message }}
      onClose={close}
    />
  )
}
