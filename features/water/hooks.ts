import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import {
  addDirectWaterGlasses,
  getMealHydration,
  getWaterBreakdown,
  getWaterFromMeals,
  getWaterGlasses,
  saveMealHydration,
  setWaterGlasses,
  type MealHydrationInput,
} from './api'

export function useWaterToday(date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.water.day(date),
    queryFn: () => getWaterGlasses(date),
    enabled,
  })
}

/*
 * Set the day's glass count — optimistic. The droplet UI flips
 * instantly off the cached value; the upsert settles in the
 * background. On error the cached count rolls back.
 */
export function useSetWater(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (glasses: number) => setWaterGlasses(date, glasses),
    onMutate: async (glasses) => {
      await qc.cancelQueries({ queryKey: queryKeys.water.day(date) })
      const prev = qc.getQueryData<number>(queryKeys.water.day(date))
      qc.setQueryData(queryKeys.water.day(date), glasses)
      return { prev }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(queryKeys.water.day(date), context?.prev ?? 0)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.water.day(date) })
    },
  })
}

/*
 * El agua que las comidas del día aportan (suma de aportes aceptados). Se
 * lee aparte del agua directa para que el stepper de QuickLog conserve su
 * optimismo intacto: el total que ve la usuaria = useWaterToday (directa) +
 * esto (comidas). Ver TodayUniverseRewards.
 */
export function useWaterFromMeals(date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.water.fromMeals(date),
    queryFn: () => getWaterFromMeals(date),
    enabled,
  })
}

/** Desglose directo/comidas/total — para el detalle de la tarjeta de Agua. */
export function useWaterBreakdown(date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.water.breakdown(date),
    queryFn: () => getWaterBreakdown(date),
    enabled,
  })
}

/** La decisión de hidratación guardada para una comida (recalc al editar). */
export function useMealHydration(mealId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.water.meal(mealId ?? ''),
    queryFn: () => getMealHydration(mealId!),
    enabled: !!mealId,
  })
}

/*
 * Guarda la decisión de hidratación de una comida (aceptar/editar/rechazar).
 * Al asentar invalida TODO el árbol de agua (day + fromMeals + breakdown) y
 * el brief, para que la tarjeta de Agua y el desglose reflejen el cambio.
 */
export function useSaveMealHydration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MealHydrationInput) => saveMealHydration(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.water.all })
      qc.invalidateQueries({ queryKey: queryKeys.water.meal(variables.mealId) })
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}

/*
 * Suma agua DIRECTA por delta (caso "agua pura registrada por el escáner de
 * comida": entra como agua directa, sin crear comida). Invalida el árbol de
 * agua + el brief para refrescar la tarjeta de Agua y el stepper.
 */
export function useAddDirectWater() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, delta }: { date: string; delta: number }) =>
      addDirectWaterGlasses(date, delta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.water.all })
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}
