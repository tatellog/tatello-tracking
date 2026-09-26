import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { mealPhotoUrl, type Meal } from '@/features/macros/api'
import { colors, typography } from '@/theme'

import { BowlIcon } from './AllyCard'

const PHOTO = 40

/*
 * La lista del día en Comidas — responde "¿qué comí?" (dirección de arte +
 * ux sep 2026). Filas sin card: foto del plato · nombre · proteína · ›, y
 * debajo "Cena · 8:40 pm · 210 kcal" (las kcal como contexto, nunca como
 * presupuesto). Un tap abre la comida en el editor, donde también se borra.
 * Los astros de arriba agregan; esta lista se lee y se edita.
 */

type MomentType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MOMENT_LABEL: Record<MomentType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
}

function momentOf(meal: Meal): MomentType {
  const t = meal.meal_type
  return t === 'breakfast' || t === 'lunch' || t === 'dinner' ? t : 'snack'
}

/* "8:40 pm" — hora cálida de 12 horas. */
function formatTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const meridiem = h < 12 ? 'am' : 'pm'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${meridiem}`
}

type Props = {
  meals: readonly Meal[]
  viewingPast: boolean
  onOpenMeal: (id: string) => void
}

export function DayMealList({ meals, viewingPast, onOpenMeal }: Props) {
  if (meals.length === 0) {
    // Hoy vacío: no hay lista (los astros ya invitan). Día pasado: se dice.
    return viewingPast ? <Text style={styles.empty}>Sin comidas registradas este día.</Text> : null
  }

  const sorted = [...meals].sort(
    (a, b) => new Date(a.consumed_at).getTime() - new Date(b.consumed_at).getTime(),
  )

  return (
    <View style={styles.list}>
      {sorted.map((meal, i) => {
        const moment = momentOf(meal)
        const protein = Math.round(Number(meal.protein_g))
        const sub = `${MOMENT_LABEL[moment]} · ${formatTime(meal.consumed_at)} · ${meal.calories} kcal`
        return (
          <Pressable
            key={meal.id}
            onPress={() => onOpenMeal(meal.id)}
            style={({ pressed }) => [
              styles.row,
              i > 0 && styles.rowDivider,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${MOMENT_LABEL[moment]}, ${meal.name}, ${protein} gramos de proteína. Toca para editar.`}
          >
            {/* La foto del plato (misma que en frecuentes); el momento ya lo
                dice la línea de abajo, así que no se repite el astro. */}
            {meal.photo_storage_path ? (
              <Image
                source={{ uri: mealPhotoUrl(meal.photo_storage_path) }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]}>
                <BowlIcon color={colors.oroSoft} />
              </View>
            )}
            <View style={styles.textCol}>
              <View style={styles.topLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {meal.name}
                </Text>
                <Text style={styles.protein}>{protein} g</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.sub}>{sub}</Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  pressed: { opacity: 0.75 },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
  },
  photoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lecheTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  protein: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  sub: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.2,
    color: colors.niebla,
  },
  empty: {
    marginTop: 16,
    marginLeft: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
