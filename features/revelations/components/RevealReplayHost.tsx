import { useEffect, useState } from 'react'

import { useProfile } from '@/features/profile/hooks'
import { useTransformProgress } from '@/features/emblem'
import { PatternRevealModal } from '@/features/orbit/components/PatternRevealModal'
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
  // pattern → la ceremonia con el patrón de ESTE día: observación + PRUEBA
  // (correlación con el déficit si existe, o la frecuencia) + significado.
  const hasBars = replay.evidenceBars != null && replay.evidenceBars.length > 0
  return (
    <PatternRevealModal
      phrase={replay.title || replay.message}
      // Observación (title) → PRUEBA → significado (message). La prueba es la
      // correlación con el déficit si existe (countLine = su porqué); si no, la
      // frecuencia; si nada, el detalle (sin repetir el título).
      countLine={
        hasBars
          ? (replay.correlationInsight ?? '')
          : replay.evidence || (replay.message !== replay.title ? replay.message : '')
      }
      takeaway={hasBars || replay.evidence ? replay.message : ''}
      // Barras de correlación con el déficit (Etapa 3) > tira de frecuencia.
      bars={hasBars ? replay.evidenceBars : undefined}
      evidence={
        replay.evidenceCount != null && replay.evidenceTotal != null
          ? { count: replay.evidenceCount, total: replay.evidenceTotal }
          : undefined
      }
      onClose={close}
    />
  )
}
