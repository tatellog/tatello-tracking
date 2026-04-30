import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

import type { MealType } from '../utils/mealType'

export type MealSuggestion = {
  id: string
  source: 'yesterday' | 'recent'
  name: string
  protein_g: number
  calories: number
}

/*
 * Pulls up to 3 suggestions for the current meal slot via the
 * server-side RPC (20260430120001 migration). The RPC handles the
 * distinct-by-name logic and the "Lo de ayer" priority — the client
 * only needs to render.
 *
 * staleTime 5 min so opening / closing the screen during a session
 * doesn't refetch every time. Logging a meal invalidates this key
 * via useCreateMeal's onSettled.
 */
export function useMealSuggestions(mealType: MealType) {
  return useQuery({
    queryKey: queryKeys.macros.suggestions(mealType),
    queryFn: async (): Promise<MealSuggestion[]> => {
      const { data, error } = await supabase.rpc('get_meal_suggestions', {
        p_meal_type: mealType,
        p_limit: 3,
      })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        source: row.source as MealSuggestion['source'],
        name: row.name,
        protein_g: Number(row.protein_g),
        calories: row.calories,
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}
