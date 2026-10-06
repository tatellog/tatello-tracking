/*
 * "Repetir tu día de ayer" (dueña 6 oct 2026) — para quien come casi igual
 * entre semana: todas las comidas de ayer en un tap, cada una en su momento y
 * con sus ingredientes, con un solo Deshacer para todas. Solo se ofrece si ayer
 * hubo 2+ comidas y el día que se registra sigue vacío (nunca duplica). Lo
 * comparten Registrar y Comidas.
 */
import { mealIngredients, type MealInput } from '@/features/macros/api'
import { useCreateMeal, useMealsForDate } from '@/features/macros/hooks'

import { emitMealUndo } from './undo-meal-bus'

type MealType = MealInput['meal_type']
const MEAL_TYPES: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** El día anterior a un 'YYYY-MM-DD' (por componentes: Hermes y fechas). */
export function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const prev = new Date(y, m - 1, d - 1, 12)
  const mm = String(prev.getMonth() + 1).padStart(2, '0')
  const dd = String(prev.getDate()).padStart(2, '0')
  return `${prev.getFullYear()}-${mm}-${dd}`
}

export type RepeatDaySummary = { count: number; kcal: number; protein: number }

export function useRepeatYesterday(opts: {
  /** El día que se registra ('YYYY-MM-DD'). */
  logDate: string
  enabled: boolean
  /** Cuándo queda cada comida (ahora, o mediodía del día visto). */
  consumedAt: () => Date
  /** "hoy" / "3 de octubre": a qué se sumaron, para el Deshacer. */
  dayLabel: string
  /** Momento de respaldo si una comida de ayer trae uno desconocido. */
  fallbackType: MealType
}): { summary: RepeatDaySummary | null; repeat: (onSaved?: () => void) => void } {
  const yesterday = useMealsForDate(opts.enabled ? dayBefore(opts.logDate) : null)
  const today = useMealsForDate(opts.enabled ? opts.logDate : null)
  const createMeal = useCreateMeal()
  const meals = yesterday.data ?? []

  const summary =
    meals.length >= 2 && today.data != null && today.data.length === 0
      ? {
          count: meals.length,
          kcal: Math.round(meals.reduce((a, m) => a + m.calories, 0)),
          protein: Math.round(meals.reduce((a, m) => a + m.protein_g, 0)),
        }
      : null

  const repeat = (onSaved?: () => void) => {
    if (!summary) return
    const at = opts.consumedAt()
    Promise.all(
      meals.map((m) =>
        createMeal.mutateAsync({
          name: m.name,
          protein_g: m.protein_g,
          calories: m.calories,
          consumed_at: at,
          meal_type: MEAL_TYPES.includes(m.meal_type as MealType)
            ? (m.meal_type as MealType)
            : opts.fallbackType,
          photo_storage_path: m.photo_storage_path,
          ingredients: mealIngredients(m) ?? undefined,
        }),
      ),
    )
      .then((created) => {
        onSaved?.()
        emitMealUndo({
          id: created[0]!.id,
          ids: created.map((c) => c.id),
          name: `${created.length} comidas de ayer`,
          mealTypeLabel: opts.dayLabel,
        })
      })
      .catch(() => {})
  }

  return { summary, repeat }
}
