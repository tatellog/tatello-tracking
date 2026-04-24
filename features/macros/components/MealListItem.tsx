import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'

import type { Meal } from '@/features/macros/api'
import { colors, radius, spacing, typography } from '@/theme'

type Props = {
  meal: Meal
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const DELETE_THRESHOLD = -120

/*
 * Single row in the Comidas list. Pan left past 120 px triggers a
 * delete confirmation (Alert.alert — a system dialog so there's no
 * ambiguity about what's about to happen). Short swipes spring back.
 *
 * Tap the row to edit — the name / macros / time all lead to the
 * same form reuse path.
 */
export function MealListItem({ meal, onEdit, onDelete }: Props) {
  const translateX = useSharedValue(0)

  const confirmDelete = () => {
    Alert.alert('Borrar esta comida', `"${meal.name}"`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => onDelete(meal.id),
      },
    ])
  }

  const gesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.min(0, event.translationX)
    })
    .onEnd((event) => {
      if (event.translationX < DELETE_THRESHOLD) {
        runOnJS(confirmDelete)()
      }
      translateX.value = withSpring(0, { damping: 18 })
    })

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const time = new Date(meal.consumed_at).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.row, rowStyle]}>
        <Pressable
          onPress={() => onEdit(meal.id)}
          style={styles.pressable}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${meal.name}`}
          accessibilityHint="Desliza a la izquierda para borrar"
        >
          <View style={styles.time}>
            <Text style={styles.timeText}>{time}</Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={1}>
              {meal.name}
            </Text>
            <Text style={styles.macros}>
              {Number(meal.protein_g)}g · {meal.calories} cal
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.creamShelf,
    borderRadius: radius.input,
    borderWidth: 0.5,
    borderColor: colors.goldAlpha18,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  time: {
    minWidth: 48,
  },
  timeText: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
  },
  content: {
    flex: 1,
  },
  name: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.forestDeep,
  },
  macros: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.softLabel,
    color: colors.goldSoft,
    marginTop: 2,
  },
})
