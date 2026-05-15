import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import type { Meal } from '@/features/macros/api'
import { useDeleteMeal, useMealsForDate } from '@/features/macros/hooks'
import { confirmBinary, useConfirm } from '@/lib/confirm'
import { colors, typography } from '@/theme'

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Snack',
}

// ── Estela geometry ────────────────────────────────────────────────
const RAIL_WIDTH = 28
const THREAD_WIDTH = 2
const THREAD_LEFT = (RAIL_WIDTH - THREAD_WIDTH) / 2
const NODE_CENTER_Y = 8
// Vertical gap between meals — the estela thread runs through it.
const ROW_GAP = 26

// ── Swipe-to-delete ────────────────────────────────────────────────
// Drag the row left; release past DELETE_THRESHOLD to fire the delete
// confirmation. DRAG_MAX clamps the travel so the row can't fly off.
const DELETE_THRESHOLD = -88
const DRAG_MAX = 120
const SPRING = { damping: 22, stiffness: 220 } as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function TrashIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 6h17" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M9 6V4.6A1.6 1.6 0 0 1 10.6 3h2.8A1.6 1.6 0 0 1 15 4.6V6"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 6.5l.85 12.4A1.7 1.7 0 0 0 8.5 20.5h7a1.7 1.7 0 0 0 1.65-1.6L18 6.5"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type Props = {
  /** ISO 'YYYY-MM-DD' — the day whose meals to list (today on Hoy). */
  date: string
  /** Open a meal in the Comidas core (tap a row to edit it there). */
  onOpenMeal: (id: string) => void
}

/* "La estela de hoy" — today's meals as a comet trail.
 *
 * The most recent meal is the comet's HEAD (large, glowing node);
 * earlier meals are the TAIL (nodes shrink + dim, the trail line
 * fades). Meal text stays fully legible regardless of age.
 *
 * Tap a row → open the meal in Comidas to edit. Swipe a row left past
 * the threshold → delete (with confirmation). The estela rail itself
 * never slides — only the meal content does — so the comet trail
 * stays unbroken during a swipe. */
export function TodayMealLog({ date, onOpenMeal }: Props) {
  const { data: meals } = useMealsForDate(date)
  const deleteMeal = useDeleteMeal()
  const choose = useConfirm()

  const handleRequestDelete = async (meal: Meal) => {
    const ok = await confirmBinary(choose, {
      title: 'Borrar esta comida',
      description: `"${meal.name}"`,
      confirmLabel: 'Borrar',
      destructive: true,
    })
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      deleteMeal.mutate(meal.id)
    }
  }

  if (!meals || meals.length === 0) {
    return <Text style={styles.empty}>Todavía sin comidas.</Text>
  }

  const n = meals.length

  return (
    <View style={styles.list}>
      {meals.map((meal, i) => (
        <Animated.View key={meal.id} entering={FadeInDown.duration(340).delay(Math.min(i, 6) * 55)}>
          <EstelaRow
            meal={meal}
            isFirst={i === 0}
            isRecent={i === n - 1}
            factor={n <= 1 ? 1 : i / (n - 1)}
            onOpen={onOpenMeal}
            onRequestDelete={handleRequestDelete}
          />
        </Animated.View>
      ))}
    </View>
  )
}

type RowProps = {
  meal: Meal
  isFirst: boolean
  isRecent: boolean
  /** 0 = oldest (faint tail), 1 = most recent (comet head). */
  factor: number
  onOpen: (id: string) => void
  onRequestDelete: (meal: Meal) => void
}

function EstelaRow({ meal, isFirst, isRecent, factor, onOpen, onRequestDelete }: RowProps) {
  const translateX = useSharedValue(0)

  const requestDelete = () => onRequestDelete(meal)

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      // Left-only drag, clamped so the row can't slide off.
      const next = e.translationX
      translateX.value = next > 0 ? 0 : next < -DRAG_MAX ? -DRAG_MAX : next
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        runOnJS(requestDelete)()
      }
      // Always spring back — the confirmation dialog owns the outcome.
      translateX.value = withSpring(0, SPRING)
    })

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const time = new Date(meal.consumed_at).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const nodeSize = lerp(7, 14, factor)
  const nodeStyle = {
    top: NODE_CENTER_Y - nodeSize / 2,
    left: (RAIL_WIDTH - nodeSize) / 2,
    width: nodeSize,
    height: nodeSize,
    borderRadius: nodeSize / 2,
    opacity: lerp(0.5, 1, factor),
    shadowOpacity: lerp(0, 0.95, factor),
    shadowRadius: lerp(0, 7, factor),
  }
  const threadColor = `rgba(233,30,99,${lerp(0.1, 0.52, factor).toFixed(3)})`

  return (
    <View style={styles.row}>
      {/* Estela rail — fixed, never slides, keeps the trail unbroken. */}
      <View style={styles.rail}>
        {!isFirst ? (
          <View style={[styles.threadSeg, styles.threadUpper, { backgroundColor: threadColor }]} />
        ) : null}
        {!isRecent ? (
          <View style={[styles.threadSeg, styles.threadLower, { backgroundColor: threadColor }]} />
        ) : null}
        <View style={[styles.node, nodeStyle]} />
      </View>

      {/* Swipe zone — delete affordance behind, content slides over it. */}
      <View style={styles.contentZone}>
        <View style={styles.deleteZone}>
          <TrashIcon />
        </View>

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.front, frontStyle]}>
            <Pressable
              onPress={() => onOpen(meal.id)}
              style={({ pressed }) => [
                styles.content,
                isRecent && styles.contentLast,
                pressed && styles.contentPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={meal.name}
              accessibilityHint="Desliza a la izquierda para borrar"
            >
              <Text style={styles.eyebrow}>
                {MEAL_TYPE_LABEL[meal.meal_type] ?? 'Comida'} · {time}
              </Text>
              <Text style={styles.name} numberOfLines={1}>
                {meal.name}
              </Text>
              <Text style={styles.macros}>
                {Math.round(Number(meal.protein_g))} g · {meal.calories} kcal
              </Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    marginTop: 10,
  },
  empty: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
  },
  rail: {
    width: RAIL_WIDTH,
    position: 'relative',
  },
  threadSeg: {
    position: 'absolute',
    left: THREAD_LEFT,
    width: THREAD_WIDTH,
  },
  threadUpper: {
    top: 0,
    height: NODE_CENTER_Y,
  },
  threadLower: {
    top: NODE_CENTER_Y,
    bottom: 0,
  },
  node: {
    position: 'absolute',
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  // Swipe container — clips the sliding content; delete zone hides
  // behind it until the content is dragged left.
  contentZone: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  // Delete affordance — revealed as the content slides left. Spans the
  // meal block (stops ROW_GAP short so the inter-meal gap stays clean).
  deleteZone: {
    position: 'absolute',
    top: 0,
    bottom: ROW_GAP,
    left: 0,
    right: 0,
    backgroundColor: colors.magentaDeep,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
  },
  // Opaque (page bg) so it fully covers the delete zone when closed.
  front: {
    backgroundColor: colors.bg,
  },
  content: {
    paddingLeft: 6,
    paddingBottom: ROW_GAP,
  },
  contentLast: {
    paddingBottom: 2,
  },
  contentPressed: {
    opacity: 0.62,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.8,
    color: colors.magenta,
    textTransform: 'uppercase',
  },
  name: {
    marginTop: 4,
    fontFamily: typography.displaySemi,
    fontSize: 17,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  macros: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: colors.bone,
  },
})
