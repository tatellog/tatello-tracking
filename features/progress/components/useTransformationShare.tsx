import { useMemo } from 'react'

import { useSignalsHistory } from '@/features/orbit/hooks'

import type { TimelinePhoto } from '../api'
import { processDuration, trainedByMonth } from '../share-logic'
import type { ShareCardStyle } from '../share-styles'
import { ProgressShareCard } from './ProgressShareCard'
import type { ShareOptions, ShareTab } from './ProgressShareSheet'
import { CambioIcon, RetratoIcon, TransformacionIcon } from './share-icons'

/*
 * Las tarjetas para compartir "MI TRANSFORMACIÓN" (excepción de la dueña: se
 * quedan) armadas para un par de fotos A/B. El peso de cada lado es el peso
 * REAL de esa fecha (dueña 7 oct 2026), no un promedio del historial.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function formatDateForCard(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`
}

export function useTransformationShareTabs({
  before,
  after,
  weightFrom,
  weightTo,
}: {
  before: TimelinePhoto | null
  after: TimelinePhoto | null
  weightFrom: number | null
  weightTo: number | null
}): readonly ShareTab[] {
  // Las señales cubren desde la foto del "antes" (tope ~2.5 años).
  const beforeIso = before?.taken_at.slice(0, 10) ?? null
  const historyDays = beforeIso
    ? (() => {
        const [y, m, d] = beforeIso.split('-').map(Number) as [number, number, number]
        const days = Math.ceil((Date.now() - new Date(y, m - 1, d).getTime()) / 86_400_000) + 2
        return Math.min(900, Math.max(90, days))
      })()
    : 90
  const history = useSignalsHistory(historyDays)

  return useMemo(() => {
    const beforeUrl = before?.signed_url
    const afterUrl = after?.signed_url
    if (!before || !after || !beforeUrl || !afterUrl) return []
    const bIso = before.taken_at.slice(0, 10)
    const aIso = after.taken_at.slice(0, 10)
    const trainedDates = (history.data ?? [])
      .filter((r) => r.trained === true && r.day != null)
      .map((r) => r.day!)
    const inRange = trainedDates.filter((d) => d >= bIso && d <= aIso)
    // Sin historia que llegue a la foto del antes, no se inventa el total.
    const covered = (history.data ?? []).some((r) => r.day != null && r.day <= bIso)
    const workoutsTotal = history.data
      ? covered || inRange.length > 0
        ? inRange.length
        : null
      : null
    const monthly = trainedByMonth(trainedDates, bIso, aIso)
    const duration = processDuration(bIso, aIso)

    const cardFor = (
      variant: 'retrato' | 'transformacion' | 'cambio',
      onReady: () => void,
      cardStyle: ShareCardStyle,
      opts: ShareOptions,
    ) => (
      <ProgressShareCard
        variant={variant}
        beforeUrl={beforeUrl}
        afterUrl={afterUrl}
        beforeIso={bIso}
        afterIso={aIso}
        beforeDate={formatDateForCard(bIso)}
        afterDate={formatDateForCard(aIso)}
        duration={duration}
        workoutsTotal={workoutsTotal}
        monthly={monthly}
        weightFrom={weightFrom}
        weightTo={weightTo}
        includeWeight={opts.includeWeight}
        cardStyle={cardStyle}
        onReady={onReady}
      />
    )

    return [
      {
        id: 'retrato',
        label: 'Retrato',
        icon: (active: boolean) => <RetratoIcon active={active} />,
        render: (onReady, cardStyle, opts) => cardFor('retrato', onReady, cardStyle, opts),
      },
      {
        id: 'transformacion',
        label: 'Transformación',
        icon: (active: boolean) => <TransformacionIcon active={active} />,
        recommended: true,
        render: (onReady, cardStyle, opts) => cardFor('transformacion', onReady, cardStyle, opts),
      },
      {
        id: 'cambio',
        label: 'Tu camino',
        icon: (active: boolean) => <CambioIcon active={active} />,
        render: (onReady, cardStyle, opts) => cardFor('cambio', onReady, cardStyle, opts),
      },
    ]
  }, [before, after, weightFrom, weightTo, history.data])
}
