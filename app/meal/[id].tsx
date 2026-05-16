import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Toast from 'react-native-toast-message'

import { MealForm } from '@/features/macros/components'
import { useDeleteMeal, useMealById, useUpdateMeal } from '@/features/macros/hooks'
import { confirmBinary, useConfirm } from '@/lib/confirm'

import type { MealInput } from '@/features/macros/api'

/*
 * Edit-meal screen. Loads the meal via useMealById, hands its fields
 * to MealForm as defaultValues, dispatches useUpdateMeal on submit
 * and useDeleteMeal (behind a confirm) on delete.
 *
 * meal_date is a generated column in Postgres, so if the user
 * changes consumed_at to a different day the server recomputes
 * meal_date and the row moves to that day's bucket in the estela.
 */
export default function EditMealScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const mealQuery = useMealById(id)
  const updateMeal = useUpdateMeal()
  const deleteMeal = useDeleteMeal()
  const choose = useConfirm()

  const meal = mealQuery.data

  const defaultValues: Partial<MealInput> | undefined = meal
    ? {
        name: meal.name,
        protein_g: Number(meal.protein_g),
        calories: meal.calories,
        consumed_at: new Date(meal.consumed_at),
        meal_type: meal.meal_type as MealInput['meal_type'],
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

  const handleDelete = async () => {
    if (!id || !meal) return
    const ok = await confirmBinary(choose, {
      title: 'Borrar esta comida',
      description: `"${meal.name}"`,
      confirmLabel: 'Borrar',
      destructive: true,
    })
    if (!ok) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
    deleteMeal.mutate(id)
    router.back()
  }

  // Key flips 'loading' → id once the meal lands, remounting MealForm
  // so react-hook-form re-initialises with the real values (its
  // defaultValues are read once, at mount).
  return (
    <MealForm
      key={meal ? id : 'loading'}
      headerTitle="Editar comida"
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      onCancel={() => router.back()}
      onDelete={handleDelete}
      isSubmitting={updateMeal.isPending}
    />
  )
}
