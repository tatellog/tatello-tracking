import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import type { FrequentMeal, MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals } from '@/features/macros/hooks'
import { colors, typography } from '@/theme'

import { MealCard } from './MealCard'

type MealType = MealInput['meal_type']

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]

/* The celestial glyph for each meal slot — sunrise / sun / crescent /
 * ringed planet. Same vocabulary as the meal rows on Hoy, so the slot
 * reads the same wherever it appears. */
function MealGlyph({ type, color }: { type: MealType; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      {type === 'lunch' ? (
        <>
          <Circle cx={12} cy={12} r={4.3} fill={color} />
          <Path
            d="M12 5.6 V2.8 M12 18.4 V21.2 M18.4 12 H21.2 M5.6 12 H2.8 M16.5 7.5 L18.5 5.5 M7.5 7.5 L5.5 5.5 M16.5 16.5 L18.5 18.5 M7.5 16.5 L5.5 18.5"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </>
      ) : type === 'dinner' ? (
        <Path d="M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z" fill={color} />
      ) : type === 'breakfast' ? (
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

// Meal type pre-selected by time of day so the common case needs no
// tap. The user can still override.
function defaultMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

// How long the magenta "stamped" confirmation holds before the sheet
// slides away — long enough to register the moment, short enough not
// to feel like a wait.
const CONFIRM_HOLD_MS = 520

type Props = {
  visible: boolean
  onClose: () => void
  /** Escape hatch to the Comidas core for foods not in "Lo de siempre". */
  onGoToComidas: () => void
}

/*
 * Quick log — a shortcut layer over the Comidas core, NOT a copy of
 * it. It only re-adds the user's frequent foods in one tap. Anything
 * new (search, barcode, first-time foods) routes to Comidas via the
 * escape link. "Lo de siempre" is derived from the user's own meal
 * history (see getFrequentMeals) so it costs zero schema and grows
 * on its own — empty for a brand-new user, which is honest.
 *
 * One tap logs the meal and closes the sheet: the tapped card stamps
 * magenta with a check, the others dim, and the sheet slides away.
 */
export function QuickLogSheet({ visible, onClose, onGoToComidas }: Props) {
  const { data: frequent } = useFrequentMeals()
  const createMeal = useCreateMeal()

  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  // Name of the meal currently being confirmed — drives the stamp
  // animation and locks out further taps until the sheet closes.
  const [confirmingName, setConfirmingName] = useState<string | null>(null)

  const items = frequent ?? []

  useEffect(() => {
    if (!visible) {
      setConfirmingName(null)
      setMealType(defaultMealType())
    }
  }, [visible])

  const handleLog = (item: FrequentMeal) => {
    if (confirmingName) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    createMeal.mutate({
      name: item.name,
      protein_g: item.protein_g,
      calories: item.calories,
      consumed_at: new Date(),
      meal_type: mealType,
    })
    setConfirmingName(item.name)
    setTimeout(onClose, CONFIRM_HOLD_MS)
  }

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(160)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
      </Animated.View>

      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(220)}
          style={styles.sheet}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={styles.title}>Sumar comida</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {/* Meal-slot selector — one pill, four segments, the active
              one a soft capsule. Same vocabulary as the AppTabBar. */}
          <View style={styles.typePill}>
            {MEAL_TYPES.map((mt) => {
              const active = mt.value === mealType
              const tint = active ? colors.magenta : colors.niebla
              return (
                <Pressable
                  key={mt.value}
                  onPress={() => setMealType(mt.value)}
                  style={[styles.typeSeg, active && styles.typeSegActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={mt.label}
                >
                  <MealGlyph type={mt.value} color={tint} />
                  <Text style={[styles.typeSegText, { color: tint }]}>{mt.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {items.length === 0 ? (
            <Text style={styles.empty}>
              Aún no tienes comidas frecuentes. Suma tu primera en Comidas.
            </Text>
          ) : (
            <>
              <Text style={styles.sectionLabel}>LO DE SIEMPRE</Text>
              <ScrollView style={styles.list} bounces={false} showsVerticalScrollIndicator={false}>
                {items.map((item) => {
                  const confirming = confirmingName === item.name
                  const dimmed = confirmingName != null && !confirming
                  return (
                    <MealCard
                      key={item.name}
                      style={styles.cardGap}
                      elevated
                      name={item.name}
                      protein={item.protein_g}
                      calories={item.calories}
                      state={confirming ? 'confirmed' : dimmed ? 'dimmed' : 'idle'}
                      onPress={() => handleLog(item)}
                      disabled={confirmingName != null}
                    />
                  )
                })}
              </ScrollView>
            </>
          )}

          <Pressable
            onPress={onGoToComidas}
            disabled={confirmingName != null}
            style={styles.comidasLink}
            accessibilityRole="button"
          >
            <Text style={styles.comidasLinkText}>Sumar una comida nueva →</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  )
}

const ITEMS_MAX_HEIGHT = 300

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  anchor: {
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
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 21,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  close: {
    fontFamily: typography.uiBold,
    fontSize: 16,
    color: colors.niebla,
  },
  // One stadium pill holding the four slot segments — mirrors the
  // navigation pill in AppTabBar (bgCard2, hairline, inner padding).
  typePill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
    marginBottom: 20,
  },
  typeSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 9,
    borderRadius: 22,
  },
  // Active slot — the same soft magenta-tint capsule as the active tab.
  typeSegActive: {
    backgroundColor: colors.magentaTint,
  },
  typeSegText: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  sectionLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.magenta,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  list: {
    maxHeight: ITEMS_MAX_HEIGHT,
  },
  cardGap: {
    marginBottom: 8,
  },
  empty: {
    fontFamily: typography.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.niebla,
    textAlign: 'center',
    paddingVertical: 20,
  },
  comidasLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  comidasLinkText: {
    fontFamily: typography.uiSemi,
    fontSize: 13,
    color: colors.magenta,
  },
})
