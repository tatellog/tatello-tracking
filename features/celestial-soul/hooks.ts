import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useBriefContext } from '@/features/brief/hooks'
import { useTodaySignals } from '@/features/orbit/hooks'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { queryKeys } from '@/lib/queryKeys'

import { getSoulRevealIds, getSoulRevealSourcesSince, revealSoulNode } from './api'
import { CONSISTENCY_MILESTONES, soulConfigForSign } from './config'
import { computeSoulProgress, nextNodeForSource, sourcesToReveal, stageForPct } from './logic'
import type { RevealSource, SoulRegionDef, SoulRegionKey, SoulStage } from './types'

const CEREMONY_SEEN_KEY = 'stelar.constellation.ceremony_seen'

/*
 * Flag local "ceremonia de la constelación ya vista" — el UNLOCK del Alma
 * Celeste. La secuencia es: emblema 100% → CEREMONIA → Alma Celeste. Hasta que
 * la ceremonia se cierra (markSeen), el Alma Celeste NO se activa (ni reveals
 * ni modal de etapa ni acceso a la pantalla). `seen` es null mientras carga →
 * el gate no parpadea antes de saber.
 */
export function useCeremonySeen(): { seen: boolean | null; markSeen: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(CEREMONY_SEEN_KEY)
      .then((v) => {
        if (active) setSeen(v === '1')
      })
      .catch(() => {
        if (active) setSeen(false)
      })
    return () => {
      active = false
    }
  }, [])
  const markSeen = useCallback(() => {
    setSeen(true)
    AsyncStorage.setItem(CEREMONY_SEEN_KEY, '1').catch(() => {})
  }, [])
  return { seen, markSeen }
}

/** Día local 'YYYY-MM-DD' (mismo criterio que useDayRollover). */
function todayLocalIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Ids crudos de nodos revelados del Alma Celeste de un signo. */
export function useSoulRevealIds(sign: ZodiacSign) {
  return useQuery({
    queryKey: queryKeys.celestialSoul.reveals(sign),
    queryFn: () => getSoulRevealIds(sign),
  })
}

/** Progreso DERIVADO del Alma Celeste (config del signo + nodos revelados):
 *  % total, por región, hito, opacidad del arte, y la región despertando. */
export function useSoulProgress(sign: ZodiacSign) {
  const q = useSoulRevealIds(sign)
  const config = useMemo(() => soulConfigForSign(sign), [sign])
  const revealed = useMemo(() => new Set(q.data ?? []), [q.data])
  const progress = useMemo(() => computeSoulProgress(config, revealed), [config, revealed])
  return { ...q, config, revealed, progress }
}

/*
 * Revela el PRÓXIMO nodo oculto de una fuente (al completarse su acción:
 * entrenar / proteína / agua / sueño / ánimo / constancia). Lee el set actual
 * de la caché para elegir el siguiente nodo determinista; si esa fuente ya
 * reveló todos los suyos, es no-op. Devuelve el nodo revelado (o null).
 */
export function useRevealSoulNode(sign: ZodiacSign) {
  const qc = useQueryClient()
  const config = useMemo(() => soulConfigForSign(sign), [sign])
  return useMutation({
    mutationFn: async (source: RevealSource) => {
      const ids = qc.getQueryData<string[]>(queryKeys.celestialSoul.reveals(sign)) ?? []
      const node = nextNodeForSource(config, source, new Set(ids))
      if (!node) return null
      await revealSoulNode({ sign, nodeId: node.id, source, configVersion: config.version })
      return node
    },
    onSettled: () => {
      // Refresca tanto el set de revelados como las fuentes-reveladas-hoy.
      qc.invalidateQueries({ queryKey: queryKeys.celestialSoul.all })
    },
  })
}

/** Fuentes que ya revelaron un nodo HOY (día local) — base del límite 1/día. */
export function useSoulRevealsTodaySources(sign: ZodiacSign) {
  const day = todayLocalIso()
  return useQuery({
    queryKey: queryKeys.celestialSoul.revealsToday(sign, day),
    queryFn: () => getSoulRevealSourcesSince(sign, new Date(`${day}T00:00:00`).toISOString()),
  })
}

/*
 * Reconciliador del Alma Celeste (cadencia "por día sostenido"). Lee el snapshot
 * del día (useTodaySignals) + la racha (brief) y revela, como máximo, UN nodo
 * por fuente por día cuando su condición se cumple:
 *   agua/proteína/sueño/ánimo/movimiento → registraste eso hoy
 *   constancia → tu racha alcanzó el siguiente hito (CONSISTENCY_MILESTONES)
 * Declarativo: no se engancha a cada mutación; observa el día y concilia. El
 * límite 1/fuente/día sale de las fuentes ya reveladas hoy + un ref anti-doble.
 */
export function useSoulRevealSync(sign: ZodiacSign) {
  const { data: signals } = useTodaySignals()
  const { data: brief } = useBriefContext()
  const { config, revealed, progress } = useSoulProgress(sign)
  const { data: todaySources } = useSoulRevealsTodaySources(sign)
  const reveal = useRevealSoulNode(sign)

  const streak = brief?.streak_days ?? 0
  const orbitasRevealed = progress.regions.find((r) => r.key === 'orbitas')?.revealed ?? 0

  const met = useMemo(() => {
    const s = new Set<RevealSource>()
    if ((signals?.water_glasses ?? 0) > 0) s.add('water')
    if ((signals?.meal_count ?? 0) > 0) s.add('protein')
    if ((signals?.sleep_minutes ?? 0) > 0) s.add('sleep')
    if (signals?.mood != null) s.add('mood')
    if (signals?.trained === true) s.add('training')
    if (
      orbitasRevealed < CONSISTENCY_MILESTONES.length &&
      streak >= CONSISTENCY_MILESTONES[orbitasRevealed]!
    ) {
      s.add('consistency')
    }
    return s
  }, [signals, streak, orbitasRevealed])

  const revealedTodaySources = useMemo(() => new Set(todaySources ?? []), [todaySources])

  // Guarda local por día: una fuente que ya disparó HOY queda bloqueada aunque
  // el refetch de `revealsToday` aún no la refleje (evita revelar 2 nodos/día si
  // la invalidación llega tarde). Se reinicia al cambiar el día local.
  const day = todayLocalIso()
  const firedRef = useRef<{ day: string; sources: Set<RevealSource> }>({ day, sources: new Set() })
  if (firedRef.current.day !== day) firedRef.current = { day, sources: new Set() }

  const candidates = useMemo(
    () => sourcesToReveal({ config, revealed, metSources: met, revealedTodaySources }),
    [config, revealed, met, revealedTodaySources],
  )
  const candidatesKey = candidates.slice().sort().join(',')

  useEffect(() => {
    for (const src of candidates) {
      if (firedRef.current.sources.has(src)) continue
      firedRef.current.sources.add(src) // bloquea el resto del día (no se borra en éxito)
      reveal.mutateAsync(src).catch(() => {
        firedRef.current.sources.delete(src) // si falló, permite reintento
      })
    }
    // candidatesKey resume el contenido sin re-disparar por identidad del array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesKey])
}

/*
 * Detecta el CRUCE de etapa del despertar (Nacimiento → … → Despertada) para
 * disparar el momento de revelación contenido. Sello LOCAL por signo
 * (AsyncStorage) con el minPct de la última etapa celebrada → no se repite ni
 * reaparece en un remount. La PRIMERA vez siembra la etapa actual SIN celebrar
 * (no festeja retroactivamente progreso ya existente). Devuelve la etapa a
 * revelar (o null) y un dismiss.
 */
export function useSoulStageReveal(sign: ZodiacSign) {
  const { progress } = useSoulProgress(sign)
  const pct = progress.pct
  const key = `soul-stage-seen:${sign}`

  const [pending, setPending] = useState<SoulStage | null>(null)
  const [loaded, setLoaded] = useState(false)
  const seenRef = useRef<number | null>(null) // minPct de la última etapa celebrada

  // Carga (o siembra) el sello al montar / cambiar de signo.
  useEffect(() => {
    let active = true
    setLoaded(false)
    seenRef.current = null
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(key)
        if (!active) return
        seenRef.current = stored == null ? stageForPct(pct).minPct : Number(stored)
        if (stored == null) AsyncStorage.setItem(key, String(seenRef.current)).catch(() => {})
      } catch {
        // Silencio — la revelación es un lujo, jamás bloquea la pantalla.
      } finally {
        if (active) setLoaded(true)
      }
    })()
    return () => {
      active = false
    }
    // pct fuera de deps a propósito: la siembra usa el pct del montaje; los
    // cruces posteriores los maneja el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Evalúa el cruce cuando ya cargó el sello y cambia el pct.
  useEffect(() => {
    if (!loaded || seenRef.current == null) return
    const stage = stageForPct(pct)
    if (stage.minPct > seenRef.current) {
      seenRef.current = stage.minPct
      AsyncStorage.setItem(key, String(stage.minPct)).catch(() => {})
      // El 100% ("Despertada") lo celebra el FINAL reveal (todas las regiones),
      // no el de etapa — así no salen dos momentos en el mismo hito.
      if (stage.minPct < 100) setPending(stage)
    }
  }, [loaded, pct, key])

  return { stage: pending, dismiss: () => setPending(null) }
}

/*
 * Cola de revelaciones de REGIÓN al 100% (Núcleo Despierto, etc.). Cuando una
 * región cruza a 100%, entra a la cola y se muestra su momento. Sello local por
 * signo (regiones ya celebradas). La primera evaluación con datos SIEMBRA las
 * regiones ya-100 (no festeja retroactivo); de ahí en más solo las nuevas.
 */
export function useSoulRegionReveal(sign: ZodiacSign): {
  region: SoulRegionDef | null
  dismiss: () => void
} {
  const { progress, config, isFetched } = useSoulProgress(sign)
  const key = `soul-regions-seen:${sign}`
  const [queue, setQueue] = useState<SoulRegionKey[]>([])
  const [loaded, setLoaded] = useState(false)
  const seenRef = useRef<Set<SoulRegionKey> | null>(null)
  const seededRef = useRef(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
    seenRef.current = null
    seededRef.current = false
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!active) return
        const stored: SoulRegionKey[] = v ? JSON.parse(v) : []
        seenRef.current = new Set(stored)
        setLoaded(true)
      })
      .catch(() => {
        if (active) {
          seenRef.current = new Set()
          setLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [key])

  useEffect(() => {
    if (!loaded || !isFetched || seenRef.current === null) return
    const now100 = progress.regions.filter((r) => r.pct >= 100).map((r) => r.key)
    const persist = () =>
      AsyncStorage.setItem(key, JSON.stringify([...seenRef.current!])).catch(() => {})
    if (!seededRef.current) {
      // primera evaluación con datos: sembrar lo ya-100 sin festejar
      now100.forEach((k) => seenRef.current!.add(k))
      persist()
      seededRef.current = true
      return
    }
    const fresh = now100.filter((k) => !seenRef.current!.has(k))
    if (fresh.length) {
      fresh.forEach((k) => seenRef.current!.add(k))
      persist()
      setQueue((q) => [...q, ...fresh])
    }
  }, [loaded, isFetched, progress.regions, key])

  const region = queue.length ? (config.regions.find((d) => d.key === queue[0]) ?? null) : null
  return { region, dismiss: () => setQueue((q) => q.slice(1)) }
}

/*
 * Momento FINAL — las 6 regiones al 100% ("Tu Alma Celeste ha despertado").
 * Se muestra una vez; sello local. Si ya estaba completo en la primera
 * evaluación con datos, se siembra en silencio (no festeja retroactivo).
 */
export function useSoulFinalReveal(sign: ZodiacSign): { show: boolean; dismiss: () => void } {
  const { progress, isFetched } = useSoulProgress(sign)
  const key = `soul-final-seen:${sign}`
  const [show, setShow] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const seenRef = useRef<boolean | null>(null)
  const seededRef = useRef(false)

  useEffect(() => {
    let active = true
    setLoaded(false)
    seenRef.current = null
    seededRef.current = false
    AsyncStorage.getItem(key)
      .then((v) => {
        if (!active) return
        seenRef.current = v === '1'
        setLoaded(true)
      })
      .catch(() => {
        if (active) {
          seenRef.current = false
          setLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [key])

  useEffect(() => {
    if (!loaded || !isFetched || seenRef.current === null) return
    if (!seededRef.current) {
      if (progress.fullyAwake) {
        seenRef.current = true
        AsyncStorage.setItem(key, '1').catch(() => {})
      }
      seededRef.current = true
      return
    }
    if (progress.fullyAwake && !seenRef.current) {
      seenRef.current = true
      AsyncStorage.setItem(key, '1').catch(() => {})
      setShow(true)
    }
  }, [loaded, isFetched, progress.fullyAwake, key])

  return { show, dismiss: () => setShow(false) }
}
