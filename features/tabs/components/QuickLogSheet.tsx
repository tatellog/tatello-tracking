import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'

import type { FrequentMeal, MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals } from '@/features/macros/hooks'
import { colors, typography } from '@/theme'

type MealType = MealInput['meal_type']

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]

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
            <Text style={styles.title}>Quick log</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.typeRow}>
            {MEAL_TYPES.map((mt) => {
              const active = mt.value === mealType
              return (
                <Pressable
                  key={mt.value}
                  onPress={() => setMealType(mt.value)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {mt.label}
                  </Text>
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
                    <Pressable
                      key={item.name}
                      onPress={() => handleLog(item)}
                      disabled={confirmingName != null}
                      style={({ pressed }) => [
                        styles.item,
                        confirming && styles.itemConfirming,
                        dimmed && styles.itemDimmed,
                        pressed && !confirmingName && styles.itemPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Sumar ${item.name}`}
                    >
                      <View style={styles.itemMain}>
                        <Text
                          style={[styles.itemName, confirming && styles.itemTextConfirming]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text style={[styles.itemMacros, confirming && styles.itemTextConfirming]}>
                          {Math.round(item.protein_g)} g · {item.calories} kcal
                        </Text>
                      </View>
                      <View style={[styles.addBtn, confirming && styles.addBtnConfirming]}>
                        <Text style={[styles.addIcon, confirming && styles.addIconConfirming]}>
                          {confirming ? '✓' : '+'}
                        </Text>
                      </View>
                    </Pressable>
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
            <Text style={styles.comidasLinkText}>¿Algo distinto? Ir a Comidas →</Text>
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
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.bruma,
    alignItems: 'center',
  },
  typeChipActive: {
    borderColor: colors.magenta,
    backgroundColor: 'rgba(233,30,99,0.14)',
  },
  typeChipText: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.niebla,
    letterSpacing: 0.5,
  },
  typeChipTextActive: {
    color: colors.magenta,
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bruma,
    backgroundColor: 'rgba(244,236,222,0.04)',
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemDimmed: {
    opacity: 0.32,
  },
  itemConfirming: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
    transform: [{ scale: 1.02 }],
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemName: {
    fontFamily: typography.displaySemi,
    fontSize: 16,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  itemMacros: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: colors.bone,
  },
  itemTextConfirming: {
    color: '#FFFFFF',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.magenta,
    backgroundColor: 'rgba(233,30,99,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnConfirming: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  addIcon: {
    fontFamily: typography.uiBold,
    fontSize: 20,
    lineHeight: 23,
    color: colors.magenta,
  },
  addIconConfirming: {
    fontSize: 16,
    lineHeight: 19,
  },
  empty: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
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
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.magenta,
  },
})
