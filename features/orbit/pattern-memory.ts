/*
 * Memoria de patrones (Fase 1) — el writer que vuelve Historia los patrones de
 * Órbita Mes antes de que se evaporen de la ventana rodante.
 * Spec: docs/orbita-pattern-memory-spec.md.
 *
 * "El motor piensa" (los detectores puros ya corren en el cliente vía
 * buildMonthChat); aquí solo ARCHIVAMOS el descubrimiento en el log unificado
 * `revelations` (tier='pattern'), que YA se pinta como marcador en "Tu
 * constancia" (superficie reusada, sin UI nueva).
 *
 * Reglas (decisiones de la dueña, jul 2026):
 * - Solo patrones que POTENCIAN: el rescate (Ancla) y las señales nacientes
 *   (emerging). Los obstáculos NO se archivan (un marcador de "día malo" roza la
 *   culpa · manifiesto).
 * - Snapshot CONGELADO: guardamos los números del momento en `metadata`; Historia
 *   no recalcula (inmutable, como constelación/transformación/revelaciones).
 * - Reposo de 14 días: no re-archivamos el mismo `kind` si ya se archivó en los
 *   últimos 14 días (evita el yo-yo de patrones que oscilan en el borde).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { z } from 'zod'

import { useMacroTargets } from '@/features/macros/hooks'
import { useSession } from '@/hooks/useSession'
import { PATTERN_MEMORY_ENABLED } from '@/lib/featureFlags'
import { supabase } from '@/lib/supabase'

import type { Finding } from './findings'
import { hashFindings } from './findings'
import { useSignalsHistory } from './hooks'
import { buildMonthChat } from './month-chat'
import { type PatternKind, patternKindFor } from './pattern-memory-logic'

/** Días que un patrón debe "descansar" antes de poder re-archivarse. */
const REPOSO_DAYS = 14

/** Un patrón es "fresco" (dispara el push N7) mientras se archivó hace <24h. */
const FRESH_WINDOW_MS = 24 * 3600 * 1000

/** Key del flag "hay patrón fresco" (lo lee la notificación N7). */
const freshKey = (uid: string | null) => ['orbit', 'patternMemory', 'fresh', uid] as const

/** Fila de revelación de patrón (para el chequeo de reposo). */
const PatternRowSchema = z.object({ kind: z.string(), shown_at: z.string() })

/**
 * Archiva los patrones que potencian del conjunto de hallazgos, respetando el
 * reposo de 14 días y de-dup por kind (uno por kind, el de mayor confianza).
 * Idempotente en la práctica (el reposo evita duplicados). Nunca lanza.
 */
async function archivePatterns(uid: string, findings: readonly Finding[]): Promise<number> {
  // Un candidato por kind: el de mayor confianza gana.
  const byKind = new Map<PatternKind, Finding>()
  for (const f of findings) {
    const kind = patternKindFor(f)
    if (!kind) continue
    const prev = byKind.get(kind)
    if (!prev || f.confidence > prev.confidence) byKind.set(kind, f)
  }
  if (byKind.size === 0) return 0

  // Reposo: ¿alguno de estos kinds se archivó ya en los últimos 14 días?
  const since = new Date(Date.now() - REPOSO_DAYS * 86400000).toISOString()
  const { data, error } = await supabase
    .from('revelations')
    .select('kind, shown_at')
    .eq('user_id', uid)
    .eq('tier', 'pattern')
    .in('kind', [...byKind.keys()])
    .gte('shown_at', since)
  if (error) return 0
  const recent = z.array(PatternRowSchema).safeParse(data ?? [])
  const suppressed = new Set(recent.success ? recent.data.map((r) => r.kind) : [...byKind.keys()])

  const rows = [...byKind.entries()]
    .filter(([kind]) => !suppressed.has(kind))
    .map(([kind, f]) => ({
      user_id: uid,
      tier: 'pattern' as const,
      kind,
      // La línea de Historia, en voz del coach y CONGELADA (no recalcula).
      title: f.phrase.lead,
      // Snapshot inmutable: los números de ESTE momento + la palanca + dimensión.
      metadata: {
        subject: f.subject,
        support: f.phrase.support,
        lever: f.lever ?? null,
        dimension: f.category,
        emerging: !!f.emerging,
        window: 'last31',
      },
    }))
  if (rows.length === 0) return 0

  const { error: insErr } = await supabase.from('revelations').insert(rows)
  if (insErr) return 0
  return rows.length
}

/**
 * Corre el archivado de patrones UNA vez por conjunto de hallazgos (cacheado por
 * su hash · no re-inserta en cada render, y el reposo en DB es el guard real).
 * Self-contained: calcula sus propios hallazgos, así corre igual en el segmento
 * Mes viejo (beta) que en el IA (dev). Gateado por PATTERN_MEMORY_ENABLED.
 */
export function usePatternMemoryWriter(): void {
  const { session } = useSession()
  const uid = session?.user?.id ?? null
  const { data: history } = useSignalsHistory(31)
  const signals = useMemo(() => history ?? [], [history])
  const targets = useMacroTargets().data

  const cards = useMemo(() => {
    const chat = buildMonthChat(
      signals,
      { calorieTarget: targets?.calories ?? null, proteinTarget: targets?.protein_g ?? null },
      {},
    )
    // Si no hay datos suficientes (chat no ready), no hay nada que archivar.
    return chat.ready ? chat.cards : []
  }, [signals, targets?.calories, targets?.protein_g])

  const archivable = useMemo(() => cards.filter((c) => patternKindFor(c) !== null), [cards])
  const hash = useMemo(() => hashFindings(archivable), [archivable])

  const qc = useQueryClient()
  const { data: archivedCount } = useQuery({
    queryKey: ['orbit', 'patternMemory', uid, hash],
    queryFn: () => (uid ? archivePatterns(uid, archivable) : Promise.resolve(0)),
    enabled: PATTERN_MEMORY_ENABLED && uid != null && archivable.length > 0,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  // Al archivar un patrón nuevo, refresca el flag "fresco" para que la
  // notificación N7 (montada en el tab layout) lo agende sin esperar al próximo
  // arranque (cierra la carrera archivo→notificación).
  useEffect(() => {
    if (archivedCount && archivedCount > 0) void qc.invalidateQueries({ queryKey: freshKey(uid) })
  }, [archivedCount, uid, qc])
}

/**
 * ¿Hay un patrón de Órbita archivado en las últimas 24h? Lo lee la notificación
 * N7 para decidir si agenda el push. "Fresco" caduca solo con el tiempo y se
 * refresca cuando el writer archiva algo nuevo → self-healing sin flag "visto".
 */
export function useRecentOrbitPattern(uid: string | null) {
  return useQuery({
    queryKey: freshKey(uid),
    queryFn: async (): Promise<boolean> => {
      const since = new Date(Date.now() - FRESH_WINDOW_MS).toISOString()
      const { data, error } = await supabase
        .from('revelations')
        .select('id')
        .eq('user_id', uid!)
        .eq('tier', 'pattern')
        .gte('shown_at', since)
        .limit(1)
      if (error) return false
      return (data?.length ?? 0) > 0
    },
    enabled: uid != null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
