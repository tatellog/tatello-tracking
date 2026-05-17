import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { mealPhotoUrl, type Meal } from '@/features/macros/api'
import { useDeleteMeal, useMealsForDate } from '@/features/macros/hooks'
import { SAMPLE_MEAL_PHOTOS } from '@/features/macros/sampleMealPhotos'
import { confirmBinary, useConfirm } from '@/lib/confirm'
import { colors, typography } from '@/theme'

const THUMB = 48

// ── Photo-circle pile — the section's hero summary ─────────────────
const PILE_SIZE = 56
const PILE_OVERLAP = 18
const PILE_MAX = 6

// The detail sheet's scroll area caps below the screen height.
const SHEET_BODY_MAX_H = Math.round(Dimensions.get('window').height * 0.62)

// ── Swipe-to-delete ────────────────────────────────────────────────
const DELETE_THRESHOLD = -88
const DRAG_MAX = 120
const SPRING = { damping: 22, stiffness: 220 } as const

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/* The meal's slot comes straight from the stored meal_type — the meal
 * form captures it explicitly. Anything unexpected falls back to
 * "snack" so a row is never dropped. */
function mealTypeOf(meal: Meal): MealType {
  const t = meal.meal_type
  return t === 'breakfast' || t === 'lunch' || t === 'dinner' ? t : 'snack'
}

// A stable index from a meal id, so each meal keeps the same sample.
function sampleIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i)) % 9973
  return h
}

/* The meal's photo — the dish shot saved by the scan-meal flow. In
 * development, meals without a real photo borrow a bundled sample so
 * the circles preview populated; production shows only real photos.
 * Null → the row falls back to its celestial glyph placeholder. */
function mealPhoto(meal: Meal): ImageSourcePropType | null {
  if (meal.photo_storage_path) return { uri: mealPhotoUrl(meal.photo_storage_path) }
  if (__DEV__ && SAMPLE_MEAL_PHOTOS.length > 0) {
    return SAMPLE_MEAL_PHOTOS[sampleIndex(meal.id) % SAMPLE_MEAL_PHOTOS.length] ?? null
  }
  return null
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
 * sparkle. It is the meal's node on the estela. */
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
        <>
          <Path
            d="M9.5 7 L11 12.5 L16.5 14 L11 15.5 L9.5 21 L8 15.5 L2.5 14 L8 12.5 Z"
            fill={color}
          />
          <Path
            d="M18 3.2 L18.8 5.8 L21.3 6.5 L18.8 7.3 L18 9.8 L17.2 7.3 L14.7 6.5 L17.2 5.8 Z"
            fill={color}
          />
          <Path
            d="M18.8 14 L19.3 15.6 L20.8 16 L19.3 16.4 L18.8 18 L18.3 16.4 L16.8 16 L18.3 15.6 Z"
            fill={color}
          />
        </>
      )}
    </Svg>
  )
}

/* A generic plate — the pile's placeholder when a meal has no photo.
 * Neutral on purpose: the celestial slot glyph stays for the list
 * rows, where the time of day gives it meaning. */
function DishGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.4} stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={3.6} stroke={color} strokeWidth={1.6} />
    </Svg>
  )
}

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3.5 6h17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M9 6V4.6A1.6 1.6 0 0 1 10.6 3h2.8A1.6 1.6 0 0 1 15 4.6V6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 6.5l.85 12.4A1.7 1.7 0 0 0 8.5 20.5h7a1.7 1.7 0 0 0 1.65-1.6L18 6.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/* The meal's thumbnail — a circular photo of the dish, or, when there
 * is no photo, a placeholder carrying the slot's celestial glyph
 * (sunrise / sun / crescent / sparkle). The most recent meal — the
 * comet head — wears a glowing magenta ring and breathes. */
function MealThumb({
  type,
  photo,
  isRecent,
}: {
  type: MealType
  photo: ImageSourcePropType | null
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
    transform: [{ scale: 1 + breath.value * 0.05 }],
  }))

  // A broken / empty photo falls back to the glyph — never a dead circle.
  const [failed, setFailed] = useState(false)

  return (
    <Animated.View style={[styles.thumbWrap, breathStyle]}>
      {isRecent ? <View style={styles.thumbGlow} /> : null}
      <View style={[styles.thumb, isRecent && styles.thumbRecent]}>
        {photo && !failed ? (
          <Image
            source={photo}
            style={styles.thumbPhoto}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <PeriodGlyph period={type} size={24} color={colors.magenta} />
        )}
      </View>
    </Animated.View>
  )
}

/* One disc in the photo pile — the dish photo (or its slot glyph),
 * ringed in the page colour so it reads cut out from the disc behind.
 * The most recent meal glows and breathes, the comet head. */
function PileCircle({
  meal,
  first,
  isRecent,
  onPress,
}: {
  meal: Meal
  first: boolean
  isRecent: boolean
  onPress: () => void
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
    transform: [{ scale: 1 + breath.value * 0.05 }],
  }))

  const photo = mealPhoto(meal)
  // A broken / empty photo falls back to the glyph — never a dead circle.
  const [failed, setFailed] = useState(false)

  return (
    <Animated.View style={[!first && styles.pileOverlap, breathStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={meal.name}
        accessibilityHint="Abre la lista de comidas de hoy"
      >
        {isRecent ? <View style={styles.pileGlow} /> : null}
        <View style={styles.pileCircle}>
          {photo && !failed ? (
            <Image
              source={photo}
              style={styles.pilePhoto}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <DishGlyph size={26} color={colors.niebla} />
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

/* The photo pile — the day's meals as overlapping circles, the
 * section's glanceable hero. Shows the most recent few; tapping any
 * circle opens the full detail list below. */
function MealPhotoCluster({ meals, onPressPile }: { meals: Meal[]; onPressPile: () => void }) {
  const shown = meals.slice(-PILE_MAX)
  return (
    <View style={styles.pile}>
      {shown.map((meal, i) => (
        <PileCircle
          key={meal.id}
          meal={meal}
          first={i === 0}
          isRecent={i === shown.length - 1}
          onPress={onPressPile}
        />
      ))}
    </View>
  )
}

type Props = {
  /** ISO 'YYYY-MM-DD' — the day whose meals to list (today on Hoy). */
  date: string
  /** Open a meal to edit it. */
  onOpenMeal: (id: string) => void
}

/* "Comidas de hoy" — la estela del día.
 *
 * The hero is a pile of overlapping photo circles — the day at a
 * glance, each circle a meal. Tapping any circle slides up a sheet
 * with the full detail list: a chronological set of cards where the
 * most recent meal — the comet head — glows and breathes.
 *
 * Tap a card → edit. Swipe a card left past the threshold → delete. */
export function TodayMealLog({ date, onOpenMeal }: Props) {
  const { data: meals } = useMealsForDate(date)
  const deleteMeal = useDeleteMeal()
  const choose = useConfirm()
  const [sheetOpen, setSheetOpen] = useState(false)

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
  const totalKcal = meals.reduce((sum, m) => sum + m.calories, 0)

  return (
    <View>
      <MealPhotoCluster
        meals={meals}
        onPressPile={() => {
          Haptics.selectionAsync().catch(() => {})
          setSheetOpen(true)
        }}
      />

      <Text style={styles.summary}>
        <Text style={styles.summaryStrong}>{totalKcal.toLocaleString('es-MX')}</Text> kcal ·{' '}
        <Text style={styles.summaryStrong}>{n}</Text> {n === 1 ? 'comida' : 'comidas'} en tu cielo
      </Text>

      <TodayMealsSheet
        visible={sheetOpen}
        meals={meals}
        onClose={() => setSheetOpen(false)}
        onOpenMeal={(id) => {
          setSheetOpen(false)
          onOpenMeal(id)
        }}
        onRequestDelete={handleRequestDelete}
      />
    </View>
  )
}

/* The detail list in a sheet that slides up from the bottom when a
 * pile circle is tapped — "Comidas de hoy" in full. Tap a card to
 * edit it, swipe it left to delete. */
function TodayMealsSheet({
  visible,
  meals,
  onClose,
  onOpenMeal,
  onRequestDelete,
}: {
  visible: boolean
  meals: Meal[]
  onClose: () => void
  onOpenMeal: (id: string) => void
  onRequestDelete: (meal: Meal) => void
}) {
  const n = meals.length
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* The gesture root must wrap the modal's content — a Modal is a
       * separate native view tree, so swipe-to-delete needs its own.
       * Native `slide` handles the entrance, leaving no reanimated
       * layout animation to fight the gesture handler. */}
      <GestureHandlerRootView style={styles.sheetRoot}>
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Cerrar"
          />
        </View>

        <View style={styles.sheetAnchor} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Comidas de hoy</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Text style={styles.sheetClose}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.actionHint}>
              Toca una comida para editarla · desliza para borrarla.
            </Text>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.list}>
                {meals.map((meal, i) => (
                  <MealRow
                    key={meal.id}
                    meal={meal}
                    isRecent={i === n - 1}
                    onOpen={onOpenMeal}
                    onRequestDelete={onRequestDelete}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

type RowProps = {
  meal: Meal
  /** The most recent meal — the comet head — glows. */
  isRecent: boolean
  onOpen: (id: string) => void
  onRequestDelete: (meal: Meal) => void
}

/* One meal — a card tagged with its thumbnail. Tap to edit; swipe it
 * left past the threshold to delete (a magenta zone shows behind). */
function MealRow({ meal, isRecent, onOpen, onRequestDelete }: RowProps) {
  const translateX = useSharedValue(0)
  const press = useSharedValue(0)
  const requestDelete = () => onRequestDelete(meal)

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      // Left-only drag, clamped so the card can't slide off.
      const next = e.translationX
      translateX.value = next > 0 ? 0 : next < -DRAG_MAX ? -DRAG_MAX : next
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        runOnJS(requestDelete)()
      }
      translateX.value = withSpring(0, SPRING)
    })

  // The card slides on swipe; on press its surface lifts a shade — an
  // opaque colour shift, never opacity, which would bare the delete
  // zone sitting behind the card.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    backgroundColor: interpolateColor(press.value, [0, 1], [colors.bgCard, colors.bgCard2]),
  }))

  return (
    <View style={styles.swipeZone}>
      {/* Delete affordance — hidden behind the card until swiped. */}
      <View style={styles.deleteZone}>
        <TrashIcon color="#FFFFFF" />
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onOpen(meal.id)
            }}
            onPressIn={() => {
              press.value = withTiming(1, { duration: 90 })
            }}
            onPressOut={() => {
              press.value = withTiming(0, { duration: 170 })
            }}
            accessibilityRole="button"
            accessibilityLabel={meal.name}
            accessibilityHint="Toca para editar; desliza a la izquierda para borrar"
          >
            <View style={styles.mealContent}>
              {/* Thumbnail — the dish photo, or the slot glyph placeholder. */}
              <MealThumb type={mealTypeOf(meal)} photo={mealPhoto(meal)} isRecent={isRecent} />
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
    gap: 10,
  },
  // ── Photo pile — overlapping meal circles, the section's hero. ──
  pile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 14,
    paddingVertical: 4,
  },
  pileOverlap: {
    marginLeft: -PILE_OVERLAP,
  },
  // Soft glow behind the most recent circle — the comet head.
  pileGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: PILE_SIZE + 8,
    height: PILE_SIZE + 8,
    borderRadius: (PILE_SIZE + 8) / 2,
    backgroundColor: colors.magentaTint,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 5,
  },
  // Each disc — ringed in the page colour so it cuts out cleanly. The
  // neutral fill shows only behind the no-photo plate placeholder.
  pileCircle: {
    width: PILE_SIZE,
    height: PILE_SIZE,
    borderRadius: PILE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.bgCard2,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  pilePhoto: {
    width: '100%',
    height: '100%',
  },
  // Summary line under the pile.
  summary: {
    fontFamily: typography.ui,
    fontSize: 13,
    color: colors.niebla,
  },
  summaryStrong: {
    fontFamily: typography.displaySemi,
    color: colors.bone,
  },
  // ── Detail sheet — slides up from the bottom on a pile tap. ─────
  sheetRoot: {
    flex: 1,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  sheetAnchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bruma,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: 20,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  sheetClose: {
    fontFamily: typography.uiBold,
    fontSize: 16,
    color: colors.niebla,
  },
  sheetBody: {
    maxHeight: SHEET_BODY_MAX_H,
  },
  // Thumbnail — a circular dish photo, or a glyph placeholder. The
  // wrap is unclipped so the recent meal's glow can spill past it.
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The comet head's glow — soft and edgeless behind the recent thumb.
  thumbGlow: {
    position: 'absolute',
    width: THUMB + 8,
    height: THUMB + 8,
    borderRadius: (THUMB + 8) / 2,
    backgroundColor: colors.magentaTint,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 9,
    elevation: 4,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  thumbRecent: {
    borderColor: colors.magenta,
  },
  thumbPhoto: {
    width: '100%',
    height: '100%',
  },
  // The swipe track — clips the card so the delete zone behind it
  // only shows as the card slides left.
  swipeZone: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  deleteZone: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.magentaDeep,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
  },
  // Each meal is a card — an opaque surface with a hairline edge; it
  // slides on swipe to bare the delete zone behind it.
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  mealContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
})
