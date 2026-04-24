import { useLocalSearchParams, useRouter } from 'expo-router'
import Toast from 'react-native-toast-message'

import { MealForm } from '@/features/macros/components'
import { useMealById, useUpdateMeal } from '@/features/macros/hooks'

import type { MealInput } from '@/features/macros/api'

/*
 * Edit-meal screen. Loads the meal via useMealById, hands its
 * fields to MealForm as defaultValues (which becomes the initial
 * state of react-hook-form), and dispatches useUpdateMeal on
 * submit.
 *
 * meal_date is a generated column in Postgres, so if the user
 * changes consumed_at to a different day the server recomputes
 * meal_date automatically and the row moves to that day's bucket
 * in the Comidas tab.
 */
export default function EditMealScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const mealQuery = useMealById(id)
  const updateMeal = useUpdateMeal()

  const meal = mealQuery.data

  const defaultValues: Partial<MealInput> | undefined = meal
    ? {
        name: meal.name,
        protein_g: Number(meal.protein_g),
        calories: meal.calories,
        consumed_at: new Date(meal.consumed_at),
      }
    : undefined

  const onSubmit = async (values: MealInput) => {
    if (!id) return
    try {
      await updateMeal.mutateAsync({ id, input: values })
      Toast.show({ type: 'success', text1: 'Comida actualizada' })
      router.back()
    } catch {
      Toast.show({
        type: 'error',
        text1: 'No pudimos guardar',
        text2: 'Revisá tu conexión e intentá de nuevo.',
      })
    }
  }

  // Until the meal query resolves we render the form with whatever
  // defaults MealForm picks up (empty string + zeros); once it
  // lands, defaultValues-prop re-renders and react-hook-form re-
  // initialises via `values` reset. For simplicity the form always
  // renders — if the user interacts before load, their edits get
  // overwritten by the fetched meal. Acceptable edge case for MVP.

  return (
    <MealForm
      key={id ?? 'loading'}
      headerMeta="COMIDA"
      headerTitle="Editar comida"
      submitLabel="Guardar cambios"
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={() => router.back()}
      isSubmitting={updateMeal.isPending}
    />
  )
}
