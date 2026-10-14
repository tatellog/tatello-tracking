/*
 * Lo que Descubre encontró, en UN solo lugar (ST-007 · H-01): Descubre lo pinta
 * completo y Hoy destaca el primero. Los dos leen este hook, así que Hoy nunca
 * muestra algo distinto de lo que encabeza Descubre (mismo id, misma etiqueta).
 *
 * Orden del protagonista (el mismo que el feed de Descubre): "Lo que no sabías"
 * (sorpresa, etapa 3+) → "Tu día fuerte" (combo) → el primer patrón de apoyo.
 * Sin ninguno → null (Hoy no promete nada; decisión dueña 13 oct 2026).
 *
 * Solo LEE: marcar el combo como visto (seen_combos) sigue siendo cosa de
 * Descubre, para que abrir Hoy no cambie la histéresis.
 */
import { useMemo } from 'react'

import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { useWearableSleepNights } from '@/features/wearables/hooks'
import { addDaysIso } from '@/features/wearables/sleep-detail'
import { useSession } from '@/hooks/useSession'
import { todayInTimezone, userTimezone } from '@/lib/time'

import { bedtimeOffsetMinutes } from './bedtime'
import { combosBornRecently } from './combo-memory'
import { useSeenCombos } from './combo-seen'
import { earlyReading } from './early-readings'
import { useSignalsHistory } from './hooks'
import { dataMaturity } from './maturity'
import {
  pickSupportPatterns,
  qualifiedDiscoveries,
  type FeaturedDiscovery,
} from './featured-discovery'
import { discoveryLabel } from './hoy-discovery'
import { insightMeta, type InsightMeta } from './insight-events'
import { detectMonthPatterns, winningCombo } from './month-built'
import { rankSurprises } from './surprise'

export type { FeaturedDiscovery }

export function useFeaturedDiscovery() {
  // Los PATRONES son acumulativos: ventana larga (90d), no el mes calendario.
  const { data: longHistory } = useSignalsHistory(90)
  const patternSignals = useMemo(() => longHistory ?? [], [longHistory])
  const maturity = useMemo(() => dataMaturity(patternSignals), [patternSignals])

  const targets = useMacroTargets().data
  const proteinTarget = targets?.protein_g ?? null
  const calorieTarget = targets?.calories ?? null
  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  // "Lo que no sabías" (etapa 3+). La hora de dormirse vive solo en la tabla
  // del reloj: se lee la misma ventana de 90 días.
  const nightsTo = todayInTimezone()
  const sleepNights = useWearableSleepNights(addDaysIso(nightsTo, -89), nightsTo).data
  const surprises = useMemo(() => {
    if (maturity.stage < 3) return { hero: null, others: [] }
    const tz = userTimezone()
    const bedtimes = new Map<string, number>()
    for (const n of sleepNights ?? []) {
      if (n.bedtime_at) bedtimes.set(n.sleep_date, bedtimeOffsetMinutes(n.bedtime_at, tz))
    }
    return rankSurprises(patternSignals, { calorieTarget, proteinTarget, bedtimes })
  }, [maturity.stage, patternSignals, sleepNights, calorieTarget, proteinTarget])

  const firstSignal = useMemo(
    () => (maturity.stage >= 1 ? earlyReading(patternSignals, todayInTimezone()) : null),
    [maturity.stage, patternSignals],
  )

  // Histéresis del combo (dueña 26 sep 2026): un patrón ya mostrado sigue vivo
  // con la vara de permanencia.
  const seenUid = useSession().session?.user?.id ?? null
  const seenCombos = useSeenCombos(seenUid)
  const recentCombos = useMemo(
    () =>
      combosBornRecently(
        patternSignals,
        { calorieTarget, proteinTarget, waterGoalGlasses },
        todayInTimezone(),
      ),
    [patternSignals, calorieTarget, proteinTarget, waterGoalGlasses],
  )
  const seenKeys = seenCombos.keys
  const keepCombos = useMemo(
    () => [...new Set([...seenKeys, ...recentCombos])],
    [seenKeys, recentCombos],
  )
  const combo = useMemo(
    () =>
      winningCombo(patternSignals, {
        calorieTarget,
        proteinTarget,
        waterGoalGlasses,
        keep: keepCombos,
      }),
    [patternSignals, calorieTarget, proteinTarget, waterGoalGlasses, keepCombos],
  )

  const allPatterns = useMemo(
    () => detectMonthPatterns(patternSignals, { calorieTarget, proteinTarget }),
    [patternSignals, calorieTarget, proteinTarget],
  )
  const supportPatterns = useMemo(
    () => pickSupportPatterns(allPatterns, combo),
    [allPatterns, combo],
  )

  // Lo calificado = lo que el feed muestra, en su orden; el primero protagoniza.
  const qualified = qualifiedDiscoveries(surprises.hero, combo, supportPatterns)
  const featured: FeaturedDiscovery | null = qualified[0] ?? null
  // La metadata de los eventos del recorrido (ST-008): la misma etiqueta que se ve.
  const insightMetaOf = (d: FeaturedDiscovery): InsightMeta =>
    insightMeta(
      d,
      discoveryLabel(d, maturity.stage, patternSignals, {
        calorieTarget,
        proteinTarget,
        waterGoalGlasses,
      }),
      maturity.stage,
    )

  return {
    loaded: longHistory !== undefined,
    patternSignals,
    maturity,
    calorieTarget,
    proteinTarget,
    waterGoalGlasses,
    surprise: surprises.hero,
    firstSignal,
    seenUid,
    seenCombos,
    recentCombos,
    combo,
    allPatterns,
    supportPatterns,
    qualified,
    featured,
    insightMetaOf,
  }
}
