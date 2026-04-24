import { useRouter } from 'expo-router'
import Toast from 'react-native-toast-message'

import { MealForm } from '@/features/macros/components'
import { useCreateMeal } from '@/features/macros/hooks'

import type { MealInput } from '@/features/macros/api'

/*
 * Create-meal screen. Thin wrapper around MealForm — the form owns
 * every field, validation, and keyboard-handling detail; this file
 * owns only the mutation, the toast, and the back-navigation.
 *
 * Optimistic update is handled inside useCreateMeal, so by the time
 * we navigate back the Home's rings are already showing the new
 * macros. The server round-trip continues in the background; on
 * settle, the invalidate refetches truth.
 */
export default function LogMealScreen() {
  const router = useRouter()
  const createMeal = useCreateMeal()

  const onSubmit = async (values: MealInput) => {
    try {
      await createMeal.mutateAsync(values)
      Toast.show({ type: 'success', text1: 'Comida guardada' })
      router.back()
    } catch {
      Toast.show({
        type: 'error',
        text1: 'No pudimos guardar',
        text2: 'Revisá tu conexión e intentá de nuevo.',
      })
    }
  }

  return (
    <MealForm
      headerMeta="NUEVA COMIDA"
      headerTitle="Loggear comida"
      submitLabel="Guardar"
      onSubmit={onSubmit}
      onCancel={() => router.back()}
      isSubmitting={createMeal.isPending}
    />
  )
}
