import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useBriefContext } from '@/features/brief/hooks'
import { patchBriefCache, restoreBriefCache } from '@/lib/briefCache'
import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'

import {
  createMeal,
  deleteMeal,
  getFrequentMeals,
  getMealById,
  getMealsForDate,
  getMealsInRange,
  updateMeal,
  upsertMacroTargets,
  type CreateMealInput,
  type MacroTargetsInput,
  type Meal,
  type UpdateMealInput,
} from './api'
import { computeWeeklyMealStats, lastNDates, type WeeklyMealStats } from './logic'
import { computeNourishmentConsistency, type NourishmentConsistency } from './nourishment'

import { getWaterInRange } from '@/features/water/api'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'

import type { MacroTargetsRow } from '@/features/brief/api'

/* ─── targets ────────────────────────────────────────────────────── */

type MacroTargetsQuery = {
  data: MacroTargetsRow | null | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/*
 * Targets live inside BriefContext, so we derive them from the
 * single brief query instead of maintaining a parallel cache.
 * Two benefits:
 *   1. No chance of drift between two copies of the same data.
 *   2. One network round-trip at app start, not two.
 */
export function useMacroTargets(): MacroTargetsQuery {
  const brief = useBriefContext()
  return {
    data: brief.data?.targets ?? null,
    isLoading: brief.isLoading,
    isError: brief.isError,
    refetch: () => {
      brief.refetch()
    },
  }
}

export function useUpsertMacroTargets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MacroTargetsInput) => upsertMacroTargets(input),
    onSuccess: () => {
      // Only the brief cache needs invalidation now — targets live
      // inside the brief payload.
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}

/* ─── meals queries ──────────────────────────────────────────────── */

export function useMealsForDate(date: string) {
  return useQuery({
    queryKey: queryKeys.macros.meals(date),
    queryFn: () => getMealsForDate(date),
  })
}

/*
 * The "Esta semana" aggregate for Comidas — protein + logging
 * consistency over the trailing 7 days. Keyed under the ['macros','meals']
 * prefix so meal mutations refresh it for free. Stats are computed in a
 * memo (combining the week's meals with the optional protein reference),
 * so the protein target updating recomputes without a refetch.
 */
export function useWeeklyMealStats(): {
  stats: WeeklyMealStats | null
  isLoading: boolean
  isError: boolean
} {
  const today = todayInTimezone()
  const { weekDates, start } = useMemo(() => {
    const dates = lastNDates(today, 7)
    return { weekDates: dates, start: dates[0]! }
  }, [today])

  const targetsQuery = useMacroTargets()
  const mealsQuery = useQuery({
    queryKey: queryKeys.macros.weeklyStats(today),
    queryFn: () => getMealsInRange(start, today),
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
  })

  const proteinTarget = targetsQuery.data?.protein_g ?? null
  const stats = useMemo(
    () =>
      mealsQuery.data ? computeWeeklyMealStats(mealsQuery.data, weekDates, proteinTarget) : null,
    [mealsQuery.data, weekDates, proteinTarget],
  )

  return { stats, isLoading: mealsQuery.isLoading, isError: mealsQuery.isError }
}

/* ─── nourishment consistency (the "Lo que alimenta tu transformación"
 *     rows in Comidas) ──────────────────────────────────────────────
 *
 * Days fulfilled over the last 10 days: Proteína (days that reached the
 * reference) and Agua (days the glass goal was met) — both real
 * nutrients. All read-only, manifesto-safe framing lives in the pure
 * computeNourishmentConsistency. */
const NOURISH_WINDOW = 10

export function useNourishmentConsistency(): {
  data: NourishmentConsistency | null
  isLoading: boolean
  isError: boolean
} {
  const today = todayInTimezone()
  const { dates, start } = useMemo(() => {
    const d = lastNDates(today, NOURISH_WINDOW)
    return { dates: d, start: d[0]! }
  }, [today])

  const targetsQuery = useMacroTargets()
  const { goalMl } = useWaterGoal()
  const goalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  const mealsQuery = useQuery({
    queryKey: queryKeys.macros.nourishment(today),
    queryFn: () => getMealsInRange(start, today),
    staleTime: 5 * 60_000,
    refetchOnMount: 'always',
  })
  const waterQuery = useQuery({
    queryKey: queryKeys.water.range(start, today),
    queryFn: () => getWaterInRange(start, today),
    staleTime: 5 * 60_000,
  })

  const proteinTarget = targetsQuery.data?.protein_g ?? null
  const data = useMemo(() => {
    if (!mealsQuery.data || !waterQuery.data) return null
    const waterByDate: Record<string, number> = {}
    for (const w of waterQuery.data) waterByDate[w.intake_date] = w.glasses
    return computeNourishmentConsistency({
      dates,
      meals: mealsQuery.data,
      waterByDate,
      proteinTarget,
      waterGoalGlasses: goalGlasses,
    })
  }, [mealsQuery.data, waterQuery.data, dates, proteinTarget, goalGlasses])

  return {
    data,
    isLoading: mealsQuery.isLoading || waterQuery.isLoading,
    isError: mealsQuery.isError || waterQuery.isError,
  }
}

export function useMealById(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.macros.meal(id) : ['macros', 'meal', 'noop'],
    queryFn: () => getMealById(id!),
    enabled: Boolean(id),
  })
}

/* Frequent meals power the Hoy-tab quick log. Invalidated whenever a
 * meal is created/updated/deleted so "Lo de siempre" stays honest.
 * The limit is part of the key: the quick log wants the top few, the
 * meal search wants the whole vocabulary — distinct cache entries.
 * Invalidations use the base key, which prefix-matches both. */
export function useFrequentMeals(limit = 8, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.macros.frequentMeals(), limit],
    queryFn: () => getFrequentMeals(limit),
    enabled,
  })
}

/* ─── meal mutations ─────────────────────────────────────────────── */

/*
 * Create a meal — optimistic. Bumps today_macros + meal_count_today
 * so the Home's rings grow instantly; the server round-trip happens
 * in the background. Rollback on error; invalidate on settle so
 * server truth replaces the estimate.
 */
export function useCreateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMealInput) => createMeal(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: queryKeys.brief.all })
      return patchBriefCache(qc, (ctx) => ({
        ...ctx,
        today_macros: {
          protein_g: ctx.today_macros.protein_g + input.protein_g,
          calories: ctx.today_macros.calories + input.calories,
        },
        meal_count_today: ctx.meal_count_today + 1,
      }))
    },
    onError: (_err, _vars, context) => restoreBriefCache(qc, context),
    onSettled: (_data, _err, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      // Refetch every day's meal list by prefix. The meal_date bucket
      // is computed server-side in the app timezone, so a UTC date
      // derived here (consumed_at.toISOString) would point at the wrong
      // day after ~6pm local — leaving the Hoy estela stale right after
      // a late-evening log.
      qc.invalidateQueries({ queryKey: ['macros', 'meals'] })
      // The suggestion RPC is meal-type-scoped, so re-fetching the
      // current slot keeps "Lo de ayer" honest after a fresh insert.
      qc.invalidateQueries({ queryKey: queryKeys.macros.suggestions(variables.meal_type) })
      qc.invalidateQueries({ queryKey: queryKeys.macros.frequentMeals() })
    },
  })
}

/*
 * Update a meal — optimistic. Needs the previous meal to compute
 * the macro delta (new - old), so we snapshot it from the cache
 * inside onMutate. Falls back to a plain invalidate if the meal
 * isn't cached (edge case: deep-link edit without previous visit).
 */
export function useUpdateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMealInput }) => updateMeal(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: queryKeys.brief.all })
      const existing = qc.getQueryData<Meal>(queryKeys.macros.meal(id))
      if (!existing) {
        // No cached baseline — skip the optimistic delta.
        return patchBriefCache(qc, (ctx) => ctx)
      }
      const proteinDelta = input.protein_g - Number(existing.protein_g)
      const calorieDelta = input.calories - existing.calories
      return patchBriefCache(qc, (ctx) => ({
        ...ctx,
        today_macros: {
          protein_g: ctx.today_macros.protein_g + proteinDelta,
          calories: ctx.today_macros.calories + calorieDelta,
        },
      }))
    },
    onError: (_err, _vars, context) => restoreBriefCache(qc, context),
    onSuccess: () => {
      // A meal's consumed_at can be edited to a different day, which
      // moves it between day lists. Invalidating only the new date
      // would leave the old day's cached estela showing the stale
      // meal — so invalidate the whole macros namespace, covering
      // both day lists and the meal detail.
      qc.invalidateQueries({ queryKey: queryKeys.macros.all })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      qc.invalidateQueries({ queryKey: queryKeys.macros.frequentMeals() })
    },
  })
}

/*
 * Delete a meal — optimistic. Subtracts the meal's macros from
 * today_macros and drops meal_count_today by one, then invalidates
 * on settle. If the meal isn't in the cache we skip the optimistic
 * step; the UI corrects itself on the refetch.
 */
export function useDeleteMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMeal(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.brief.all })
      const existing = qc.getQueryData<Meal>(queryKeys.macros.meal(id))
      if (!existing) {
        return patchBriefCache(qc, (ctx) => ({
          ...ctx,
          meal_count_today: Math.max(0, ctx.meal_count_today - 1),
        }))
      }
      return patchBriefCache(qc, (ctx) => ({
        ...ctx,
        today_macros: {
          protein_g: Math.max(0, ctx.today_macros.protein_g - Number(existing.protein_g)),
          calories: Math.max(0, ctx.today_macros.calories - existing.calories),
        },
        meal_count_today: Math.max(0, ctx.meal_count_today - 1),
      }))
    },
    onError: (_err, _vars, context) => restoreBriefCache(qc, context),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      qc.invalidateQueries({ queryKey: queryKeys.macros.all })
    },
  })
}
