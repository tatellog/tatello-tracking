import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useTransformProgress } from '@/features/emblem'
import { track } from '@/lib/analytics'
import { queryKeys } from '@/lib/queryKeys'

import { listRevelations, markRevelationDismissed, recordRevelation } from './api'
import { detectPendingRevelation } from './detect'
import type { PendingRevelation } from './logic'

/*
 * Historia — el timeline de todas las revelaciones mostradas. La UI de
 * Historia está faseada (spec, Decisión #4), pero el hook ya existe para
 * que las tres tiers escriban y leer el log sea trivial cuando se construya.
 */
export function useRevelationHistory(limit = 50) {
  return useQuery({
    queryKey: queryKeys.revelations.history(),
    queryFn: () => listRevelations(limit),
    staleTime: 5 * 60 * 1000,
  })
}

/*
 * El orquestador — la ÚNICA fuente de revelaciones full-screen en Hoy.
 * Detecta (server, cacheado), decide por prioridad (Regreso > Transformación
 * > Patrón > Nada), y al mostrar una la registra en `revelations` (Historia
 * + de-dup). Tras registrar, invalida la detección para que NO se re-muestre
 * el mismo momento en un remount dentro del staleTime. `active` es estado
 * local: una detección que vuelve null después no borra lo que ya se mostró.
 */
export function useRevelationOrchestrator(signLabel: string): {
  revelation: PendingRevelation | null
  dismiss: () => void
} {
  const qc = useQueryClient()
  const { progress, isLoading } = useTransformProgress()

  // Las revelaciones son momentos RAROS — la detección (≈10 lecturas a
  // Supabase) no necesita correr en el primer paint, donde compite con los
  // ~15 hooks del arranque de Hoy. Se difiere a idle (~2 s): para entonces la
  // constelación y lo crítico ya pintaron, y el reveal (si toca) aparece igual.
  const [detectReady, setDetectReady] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setDetectReady(true), 2000)
    return () => clearTimeout(id)
  }, [])

  const detection = useQuery({
    // El progreso entra en la key (entero) para re-evaluar cuando el emblema
    // cruza un umbral; staleTime largo + sin refetch al montar evita correr
    // la detección en cada render.
    queryKey: [...queryKeys.revelations.pending(), Math.floor(progress), signLabel],
    queryFn: () => detectPendingRevelation({ transformProgress: progress, signLabel }),
    enabled: detectReady && !isLoading && signLabel.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const [active, setActive] = useState<{ rev: PendingRevelation; id: string | null } | null>(null)
  const shownRef = useRef(false)

  useEffect(() => {
    const pending = detection.data
    if (!pending || active || shownRef.current) return
    shownRef.current = true
    void recordRevelation({
      tier: pending.tier,
      kind: pending.kind,
      title: pending.title,
      metadata: pending.metadata,
    })
      .then((row) => {
        // Transformación duplicada (ya revelada en otra sesión/dispositivo) →
        // no re-mostrar el hito.
        if (!row && pending.tier === 'transformation') return
        setActive({ rev: pending, id: row?.id ?? null })
        track(`revelation_${pending.tier}_shown`, { kind: pending.kind })
        // Re-detectar: ahora el rate-limit / umbral mostrado la excluye.
        void qc.invalidateQueries({ queryKey: queryKeys.revelations.pending() })
        void qc.invalidateQueries({ queryKey: queryKeys.revelations.history() })
      })
      .catch(() => {
        // El registro nunca bloquea el momento: mostrar igual, sin id.
        setActive({ rev: pending, id: null })
        track(`revelation_${pending.tier}_shown`, { kind: pending.kind })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detection.data, active])

  const dismiss = (): void => {
    if (active) {
      track(`revelation_${active.rev.tier}_dismissed`, { kind: active.rev.kind })
      if (active.id) void markRevelationDismissed(active.id)
    }
    setActive(null)
  }

  return { revelation: active?.rev ?? null, dismiss }
}
