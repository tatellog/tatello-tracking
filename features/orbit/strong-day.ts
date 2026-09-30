/*
 * El patrón de "Tu día fuerte" fuera de Descubre (p. ej. la frase de arriba en
 * Tu smartwatch). Misma receta que MonthSegment: 90 días de señales, las metas
 * de la usuaria y la histéresis (lo ya mostrado + lo nacido hace poco), para
 * que las dos pantallas nunca hablen de patrones distintos. Solo LEE lo ya
 * mostrado; marcarlo sigue siendo trabajo de Descubre.
 */
import { useMemo } from 'react'

import { useMacroTargets } from '@/features/macros/hooks'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { useSession } from '@/hooks/useSession'
import { todayInTimezone } from '@/lib/time'

import { comboToday, type ComboTodayHabit } from './combo-facts'
import { combosBornRecently } from './combo-memory'
import { useSeenCombos } from './combo-seen'
import { useSignalsHistory } from './hooks'
import { winningCombo, type WinningCombo } from './month-built'

export function useStrongDay(): { combo: WinningCombo | null; today: ComboTodayHabit[] } {
  const { data: history } = useSignalsHistory(90)
  const targets = useMacroTargets().data
  const { goalMl } = useWaterGoal()
  const uid = useSession().session?.user?.id ?? null
  const seen = useSeenCombos(uid).keys

  const signals = useMemo(() => history ?? [], [history])
  const opts = useMemo(
    () => ({
      calorieTarget: targets?.calories ?? null,
      proteinTarget: targets?.protein_g ?? null,
      waterGoalGlasses: Math.max(1, Math.round(goalMl / GLASS_ML)),
    }),
    [targets?.calories, targets?.protein_g, goalMl],
  )
  const today = todayInTimezone()

  return useMemo(() => {
    const keep = [...new Set([...seen, ...combosBornRecently(signals, opts, today)])]
    const combo = winningCombo(signals, { ...opts, keep })
    return { combo, today: combo ? comboToday(signals, combo, opts, today) : [] }
  }, [signals, opts, seen, today])
}
