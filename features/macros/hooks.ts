import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useBriefContext } from '@/features/brief/hooks'
import { queryKeys } from '@/lib/queryKeys'

import {
  createMeal,
  deleteMeal,
  getMealById,
  getMealsForDate,
  updateMeal,
  upsertMacroTargets,
  type MacroTargetsInput,
  type Meal,
  type MealInput,
} from './api'

import type { BriefContext, MacroTargetsRow } from '@/features/brief/api'

type OptimisticContext = { previous: [readonly unknown[], unknown][] }

/*
 * Helper: apply a pure transform to every cached BriefContext under
 * queryKeys.brief.*. Returns a snapshot so the onError can restore.
 * Shared by create/update/delete optimistic paths.
 */
function patchBriefCache(
  qc: ReturnType<typeof useQueryClient>,
  transform: (ctx: BriefContext) => BriefContext,
): OptimisticContext {
  const previous = qc.getQueriesData<BriefContext>({ queryKey: queryKeys.brief.all })
  qc.setQueriesData<BriefContext>({ queryKey: queryKeys.brief.all }, (ctx) => {
    if (!ctx) return ctx
    return transform(ctx)
  })
  return { previous: previous as [readonly unknown[], unknown][] }
}

function restoreBriefCache(
  qc: ReturnType<typeof useQueryClient>,
  context: OptimisticContext | undefined,
) {
  if (!context) return
  for (const [key, data] of context.previous) {
    qc.setQueryData(key, data)
  }
}

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

export function useMealById(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.macros.meal(id) : ['macros', 'meal', 'noop'],
    queryFn: () => getMealById(id!),
    enabled: Boolean(id),
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
    mutationFn: (input: MealInput) => createMeal(input),
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
      const mealDate = variables.consumed_at.toISOString().slice(0, 10)
      qc.invalidateQueries({ queryKey: queryKeys.macros.meals(mealDate) })
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
    mutationFn: ({ id, input }: { id: string; input: MealInput }) => updateMeal(id, input),
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
    onSuccess: (meal: Meal) => {
      // meal_date is a generated column — the Supabase type generator
      // marks it nullable, guard it even though Postgres fills it.
      if (meal.meal_date) {
        qc.invalidateQueries({ queryKey: queryKeys.macros.meals(meal.meal_date) })
      }
      qc.invalidateQueries({ queryKey: queryKeys.macros.meal(meal.id) })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
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
