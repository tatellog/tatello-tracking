import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { briefKeys } from '@/features/brief/hooks'

import {
  createMeal,
  deleteMeal,
  getMacroTargets,
  getMealById,
  getMealsForDate,
  updateMeal,
  upsertMacroTargets,
  type MacroTargetsInput,
  type Meal,
  type MealInput,
} from './api'

/*
 * Query key tree for macros. Mirrors the briefKeys pattern — a
 * single root tuple lets us invalidate the whole feature with one
 * call, while the sub-tuples keep date-specific caches independent.
 */
export const macroKeys = {
  all: ['macros'] as const,
  targets: () => ['macros', 'targets'] as const,
  meals: (date: string) => ['macros', 'meals', date] as const,
  meal: (id: string) => ['macros', 'meal', id] as const,
}

/* ─── targets ────────────────────────────────────────────────────── */

export function useMacroTargets() {
  return useQuery({
    queryKey: macroKeys.targets(),
    queryFn: getMacroTargets,
  })
}

export function useUpsertMacroTargets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MacroTargetsInput) => upsertMacroTargets(input),
    onSuccess: () => {
      // Setting targets flips the Home from banner to rings + unlocks
      // the log-meal CTA. Both read through the brief, so invalidating
      // that tree + the targets query covers every surface.
      qc.invalidateQueries({ queryKey: briefKeys.all })
      qc.invalidateQueries({ queryKey: macroKeys.targets() })
    },
  })
}

/* ─── meals queries ──────────────────────────────────────────────── */

export function useMealsForDate(date: string) {
  return useQuery({
    queryKey: macroKeys.meals(date),
    queryFn: () => getMealsForDate(date),
  })
}

export function useMealById(id: string | undefined) {
  return useQuery({
    queryKey: id ? macroKeys.meal(id) : ['macros', 'meal', 'noop'],
    queryFn: () => getMealById(id!),
    enabled: Boolean(id),
  })
}

/* ─── meal mutations ─────────────────────────────────────────────── */

/*
 * Create a meal. Optimistically bumps BriefContext.today_macros and
 * meal_count_today so the Home's rings grow the instant the user
 * taps 'Guardar' — the round-trip happens in the background.
 *
 * On failure, the previous snapshot is restored. On settled, we
 * refetch everything so server truth replaces optimistic estimates.
 */
export function useCreateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MealInput) => createMeal(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: briefKeys.all })
      const previous = qc.getQueriesData({ queryKey: briefKeys.all })
      qc.setQueriesData({ queryKey: briefKeys.all }, (ctx) => {
        if (!ctx || typeof ctx !== 'object') return ctx
        const typed = ctx as {
          today_macros: { protein_g: number; calories: number }
          meal_count_today: number
        }
        return {
          ...typed,
          today_macros: {
            protein_g: typed.today_macros.protein_g + input.protein_g,
            calories: typed.today_macros.calories + input.calories,
          },
          meal_count_today: typed.meal_count_today + 1,
        }
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        qc.setQueryData(key, data)
      }
    },
    onSettled: (_data, _err, variables) => {
      qc.invalidateQueries({ queryKey: briefKeys.all })
      // Invalidate the meal list for the consumed date so the Comidas
      // tab picks up the new row when the user switches tabs.
      const mealDate = variables.consumed_at.toISOString().slice(0, 10)
      qc.invalidateQueries({ queryKey: macroKeys.meals(mealDate) })
    },
  })
}

export function useUpdateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MealInput }) => updateMeal(id, input),
    onSuccess: (meal: Meal) => {
      qc.invalidateQueries({ queryKey: briefKeys.all })
      // meal_date is a generated column — the Supabase type generator
      // marks it nullable, guard it even though Postgres fills it.
      if (meal.meal_date) {
        qc.invalidateQueries({ queryKey: macroKeys.meals(meal.meal_date) })
      }
      qc.invalidateQueries({ queryKey: macroKeys.meal(meal.id) })
    },
  })
}

export function useDeleteMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: briefKeys.all })
      qc.invalidateQueries({ queryKey: macroKeys.all })
    },
  })
}
