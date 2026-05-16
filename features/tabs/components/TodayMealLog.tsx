import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import type { Meal } from '@/features/macros/api'
import { useDeleteMeal, useMealsForDate } from '@/features/macros/hooks'
import { confirmBinary, useConfirm } from '@/lib/confirm'
import { colors, typography } from '@/theme'

const BADGE_SIZE = 30

// ── Swipe-to-delete ────────────────────────────────────────────────
const DELETE_THRESHOLD = -88
const DRAG_MAX = 120
const SPRING = { damping: 22, stiffness: 220 } as const

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/* The meal's slot comes straight from the stored meal_type — the meal
 * form captures it explicitly. Anything unexpected falls back to
 * "snack" so a row is never dropped. */
function mealTypeOf(meal: Meal): MealType {
  const t = meal.meal_type
  return t === 'breakfast' || t === 'lunch' || t === 'dinner' ? t : 'snack'
}

/* Warm 12-hour time — "8:15 am", "1:30 pm". */
function formatTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const meridiem = h < 12 ? 'am' : 'pm'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${meridiem}`
}

/* The celestial glyph for a meal slot — sunrise / sun / crescent /
 * star. It is the meal's node on the estela. */
function PeriodGlyph({ period, size, color }: { period: MealType; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {period === 'lunch' ? (
        <>
          <Circle cx={12} cy={12} r={4.3} fill={color} />
          <Path
            d="M12 5.6 V2.8 M12 18.4 V21.2 M18.4 12 H21.2 M5.6 12 H2.8 M16.5 7.5 L18.5 5.5 M7.5 7.5 L5.5 5.5 M16.5 16.5 L18.5 18.5 M7.5 16.5 L5.5 18.5"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </>
      ) : period === 'dinner' ? (
        <Path d="M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z" fill={color} />
      ) : period === 'breakfast' ? (
        <>
          <Path d="M7 17.5 A 5 5 0 0 1 17 17.5 Z" fill={color} />
          <Path
            d="M2.6 17.5 H21.4 M12 9 V6.4 M6.6 12 L4.8 10.3 M17.4 12 L19.2 10.3"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </>
      ) : (
        <Path
          d="M12 3.4 L13.7 10.3 L20.6 12 L13.7 13.7 L12 20.6 L10.3 13.7 L3.4 12 L10.3 10.3 Z"
          fill={color}
        />
      )}
    </Svg>
  )
}

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

/* The meal's glyph node. Older meals' badges dim toward the tail of
 * the estela; the most recent — the comet head — sits full magenta,
 * glowing and breathing. */
function GlyphNode({
  type,
  factor,
  isRecent,
}: {
  type: MealType
  factor: number
  isRecent: boolean
}) {
  const breath = useSharedValue(0)
  useEffect(() => {
    if (!isRecent) {
      breath.value = 0
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [isRecent, breath])

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.07 }],
  }))

  return (
    <Animated.View
      style={[
        styles.badge,
        isRecent ? styles.badgeNow : { opacity: lerp(0.5, 0.9, factor) },
        breathStyle,
      ]}
    >
      <PeriodGlyph period={type} size={15} color={colors.leche} />
    </Animated.View>
  )
}

type Props = {
  /** ISO 'YYYY-MM-DD' — the day whose meals to list (today on Hoy). */
  date: string
  /** Open a meal to edit it. */
  onOpenMeal: (id: string) => void
  /** Totals footer (count · protein · calories). On by default. */
  showFooter?: boolean
}

/* "Comidas de hoy" — la estela del día.
 *
 * A tight chronological list: each meal is a row tagged with its
 * slot's celestial glyph (sunrise / sun / moon / star). The glyph
 * badges dim up toward the tail and the most recent meal — the comet
 * head — glows and breathes; that brightness gradient is the estela,
 * no connecting line needed.
 *
 * Tap a row → edit. Swipe a row left past the threshold → delete. The
 * glyph column never slides — only the meal content does. */
export function TodayMealLog({ date, onOpenMeal, showFooter = true }: Props) {
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
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Aún no enciendes ninguna estrella hoy.</Text>
        <Text style={styles.emptyHint}>Cada comida que sumes aparece aquí, en orden.</Text>
      </View>
    )
  }

  const n = meals.length
  const totalProtein = Math.round(meals.reduce((s, m) => s + Number(m.protein_g), 0))
  const totalCalories = Math.round(meals.reduce((s, m) => s + Number(m.calories), 0))

  return (
    <View>
      <Text style={styles.actionHint}>Toca una comida para editarla · desliza para borrarla.</Text>

      <View style={styles.list}>
        {meals.map((meal, i) => (
          <Animated.View
            key={meal.id}
            entering={FadeInDown.duration(320).delay(Math.min(i, 8) * 50)}
          >
            <MealRow
              meal={meal}
              factor={n <= 1 ? 1 : i / (n - 1)}
              isRecent={i === n - 1}
              onOpen={onOpenMeal}
              onRequestDelete={handleRequestDelete}
            />
          </Animated.View>
        ))}
      </View>

      {showFooter ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerStrong}>{n}</Text> {n === 1 ? 'comida' : 'comidas'} en tu
            cielo
            {'   ·   '}
            <Text style={styles.footerStrong}>{totalProtein}</Text> g{'   ·   '}
            <Text style={styles.footerStrong}>{totalCalories}</Text> kcal
          </Text>
        </View>
      ) : null}
    </View>
  )
}

type RowProps = {
  meal: Meal
  /** 0 = oldest (faint tail), 1 = most recent (comet head). */
  factor: number
  isRecent: boolean
  onOpen: (id: string) => void
  onRequestDelete: (meal: Meal) => void
}

function MealRow({ meal, factor, isRecent, onOpen, onRequestDelete }: RowProps) {
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
      translateX.value = withSpring(0, SPRING)
    })

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View style={styles.row}>
      {/* Glyph node — fixed, never slides; keeps the estela intact. */}
      <GlyphNode type={mealTypeOf(meal)} factor={factor} isRecent={isRecent} />

      {/* Swipe zone — the delete affordance hides behind the content. */}
      <View style={styles.swipeZone}>
        <View style={styles.deleteZone}>
          <TrashIcon />
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.front, frontStyle]}>
            <Pressable
              onPress={() => onOpen(meal.id)}
              accessibilityRole="button"
              accessibilityLabel={meal.name}
              accessibilityHint="Toca para editar; desliza a la izquierda para borrar"
            >
              {/* Layout on a plain inner View — a function `style` on
                  the Pressable does not apply here. */}
              <View style={styles.mealContent}>
                <View style={styles.mealText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {meal.name}
                  </Text>
                  <Text style={styles.meta}>
                    {formatTime(meal.consumed_at)} · {Math.round(Number(meal.protein_g))} g proteína
                  </Text>
                </View>
                <Text style={styles.kcal}>
                  <Text style={styles.kcalNum}>{meal.calories}</Text> kcal
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  emptyWrap: {
    marginTop: 12,
    marginBottom: 4,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontFamily: typography.displaySemi,
    fontSize: 15.5,
    color: colors.bone,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: 4,
    fontFamily: typography.ui,
    fontSize: 12.5,
    color: colors.niebla,
    textAlign: 'center',
  },
  actionHint: {
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.niebla,
    marginTop: 8,
    marginBottom: 12,
  },
  list: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Glyph node — magenta-rimmed badge holding the slot glyph.
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.magentaTint2,
    borderWidth: 1.5,
    borderColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The comet head — the most recent meal, glowing.
  badgeNow: {
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 5,
  },
  swipeZone: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  deleteZone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.magentaDeep,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
  },
  // Opaque (page bg) so it fully covers the delete zone when closed.
  front: {
    backgroundColor: colors.bg,
  },
  mealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  mealText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: typography.displaySemi,
    fontSize: 16.5,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  kcal: {
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.niebla,
  },
  kcalNum: {
    fontFamily: typography.displaySemi,
    fontSize: 17,
    color: colors.bone,
    letterSpacing: -0.4,
  },
  footer: {
    paddingTop: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  footerText: {
    fontFamily: typography.ui,
    fontSize: 12.5,
    color: colors.niebla,
  },
  footerStrong: {
    fontFamily: typography.displaySemi,
    color: colors.bone,
  },
})
