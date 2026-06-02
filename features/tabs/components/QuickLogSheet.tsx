import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import type { FrequentMeal, MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals } from '@/features/macros/hooks'
import { useAddMeasurement, useMeasurements } from '@/features/progress/hooks'
import { toWeightPoints } from '@/features/progress/logic'
import { useSetWater, useWaterToday } from '@/features/water/hooks'
import { showActionSheet } from '@/lib/actionSheet'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { MealCard } from './MealCard'
import { WeightWheel } from './WeightWheel'

type MealType = MealInput['meal_type']

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]

const CONFIRM_HOLD_MS = 520
const WATER_TARGET = 8
const DEFAULT_WEIGHT = 70
// A tumbler — water is shown as a glass, matching the "vasos" copy,
// so it never reads as a magenta blood drop / cycle tracker.
const GLASS = 'M6 3.6 H18 L16.2 20.8 H7.8 Z'
// Body height caps the scrolling area so the sheet never exceeds the
// screen on a short phone.
const BODY_MAX_H = Math.round(Dimensions.get('window').height * 0.56)

/* The celestial glyph for each meal slot — sunrise / sun / crescent /
 * sparkle. Same vocabulary as the meal rows on Hoy. */
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

/* One water glass — a magenta-filled tumbler when logged, a faint
 * outline when not. The glass shape (not a drop) keeps it from
 * reading as the cycle tracker. */
function WaterGlass({
  filled,
  size = 26,
  onPress,
  accessibilityLabel,
}: {
  filled: boolean
  size?: number
  onPress: () => void
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={GLASS}
          fill={filled ? colors.magenta : 'none'}
          stroke={filled ? colors.magenta : colors.bruma}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  )
}

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={7} width={18} height={13} rx={3} stroke={color} strokeWidth={1.8} />
      <Path
        d="M9 7 L10.4 4.6 H13.6 L15 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13.4} r={3.4} stroke={color} strokeWidth={1.8} />
    </Svg>
  )
}

// A ✦ four-point star — signals the AI text parse ("describe it, we read it").
function SparkleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
        fill={color}
      />
    </Svg>
  )
}

// Meal type pre-selected by time of day so the common case needs no tap.
function defaultMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

type Mode = 'home' | 'weight'

type Props = {
  visible: boolean
  onClose: () => void
}

/*
 * Registro rápido — one sheet to log the three things that change
 * daily: peso, agua, comida.
 *   - Peso  → opens a two-wheel weight picker (mode 'weight').
 *   - Agua  → tap a glass, logged instantly (water_intake).
 *   - Comida → the lowest-effort path leads: the slot pill + "Lo de
 *     siempre" 1-tap re-log sits up top. Below it, "una comida nueva"
 *     offers two AI methods — Con foto (shoot/pick → scan-meal) and
 *     Descríbela (type it → scan-meal describe mode). Manual entry of
 *     macros lives in the Comidas tab (MealComposer), not here.
 */
export function QuickLogSheet({ visible, onClose }: Props) {
  const router = useRouter()
  const today = useMemo(() => todayInTimezone(), [])

  const { data: frequent } = useFrequentMeals()
  const createMeal = useCreateMeal()
  const { data: measurements } = useMeasurements(90)
  const addMeasurement = useAddMeasurement()
  const { data: glasses = 0 } = useWaterToday(today)
  const setWater = useSetWater(today)

  const [mode, setMode] = useState<Mode>('home')
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [confirmingName, setConfirmingName] = useState<string | null>(null)
  const [weightDraft, setWeightDraft] = useState<number | null>(null)

  const items = frequent ?? []

  const latestWeight = useMemo(() => {
    const pts = toWeightPoints(measurements ?? [])
    return pts.length > 0 ? (pts[pts.length - 1]?.weight ?? null) : null
  }, [measurements])

  useEffect(() => {
    if (!visible) {
      setMode('home')
      setConfirmingName(null)
      setMealType(defaultMealType())
      setWeightDraft(null)
    }
  }, [visible])

  const handleLogMeal = (item: FrequentMeal) => {
    if (confirmingName) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    createMeal.mutate({
      name: item.name,
      protein_g: item.protein_g,
      calories: item.calories,
      consumed_at: new Date(),
      meal_type: mealType,
      photo_storage_path: item.photo_storage_path,
      ingredients: item.ingredients ?? undefined,
    })
    setConfirmingName(item.name)
    setTimeout(onClose, CONFIRM_HOLD_MS)
  }

  const tapDroplet = (index: number) => {
    Haptics.selectionAsync().catch(() => {})
    // Tap a droplet to fill up to it; tap the current top one to step back.
    setWater.mutate(glasses === index + 1 ? index : index + 1)
  }

  const openWeight = () => {
    setWeightDraft(latestWeight ?? DEFAULT_WEIGHT)
    setMode('weight')
  }

  const handleLogWeight = () => {
    if (weightDraft == null) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    addMeasurement.mutate({ weight_kg: Math.round(weightDraft * 10) / 10 }, { onSuccess: onClose })
  }

  // Con foto — shoot or pick a photo, then hand off to the scan-meal
  // flow which reads the plate and logs the meal.
  const openPhoto = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Cámara', 'Necesitamos permiso a la cámara para tomar la foto.')
        return
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled || !result.assets[0]) return
    onClose()
    router.push({ pathname: '/scan-meal', params: { uri: result.assets[0].uri } })
  }

  const handlePhotoLog = () => {
    if (confirmingName != null) return
    showActionSheet(
      {
        title: 'Registrar comida con foto',
        options: ['Tomar foto', 'Elegir de la galería', 'Cancelar'],
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) void openPhoto('camera')
        else if (index === 1) void openPhoto('library')
      },
    )
  }

  // Descríbela — the scan-meal screen in describe mode: type what you ate,
  // the AI parses it into ingredients (same confirm form as the photo scan).
  const handleTextLog = () => {
    if (confirmingName != null) return
    onClose()
    router.push({ pathname: '/scan-meal', params: { describe: '1' } })
  }

  // The two AI methods for a meal that ISN'T in your estela yet. Shared
  // between the empty state and the populated one. Dimmed while a 1-tap
  // re-log is confirming, so the disabled state reads visually too.
  const disabled = confirmingName != null
  const methodsBlock = (
    <View style={styles.methods}>
      <Pressable
        onPress={handlePhotoLog}
        disabled={disabled}
        style={[styles.method, styles.methodTile, disabled && styles.methodDimmed]}
        accessibilityRole="button"
        accessibilityLabel="Registrar una comida con foto"
      >
        <View style={[styles.methodIcon, styles.methodIconPhoto]}>
          <CameraIcon color={colors.magenta} />
        </View>
        <Text style={styles.methodLabel}>Con foto</Text>
      </Pressable>
      <Pressable
        onPress={handleTextLog}
        disabled={disabled}
        style={[styles.method, styles.methodTile, disabled && styles.methodDimmed]}
        accessibilityRole="button"
        accessibilityLabel="Registrar una comida describiéndola"
      >
        <View style={[styles.methodIcon, styles.methodIconPhoto]}>
          <SparkleIcon color={colors.magenta} />
        </View>
        <Text style={styles.methodLabel}>Descríbela</Text>
      </Pressable>
    </View>
  )

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
            {mode === 'weight' ? (
              <Pressable
                onPress={() => setMode('home')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Atrás"
              >
                <Text style={styles.back}>‹</Text>
              </Pressable>
            ) : (
              <View style={styles.backSpacer} />
            )}
            <Text style={styles.title}>
              {mode === 'weight' ? 'Tu peso actual' : 'Registro rápido'}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {mode === 'weight' ? (
            <View style={styles.weightPane}>
              <WeightWheel value={weightDraft ?? DEFAULT_WEIGHT} onChange={setWeightDraft} />
              <Pressable
                onPress={handleLogWeight}
                style={styles.primaryBtn}
                accessibilityRole="button"
                accessibilityLabel="Registrar peso"
              >
                <Text style={styles.primaryBtnText}>Registrar peso</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              style={styles.body}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Hoy: peso + agua, one compact strip ── */}
              <View style={styles.strip}>
                <Pressable
                  onPress={openWeight}
                  style={styles.stripZone}
                  accessibilityRole="button"
                  accessibilityLabel="Registrar peso"
                >
                  <Text style={styles.stripCaption}>Peso</Text>
                  <View style={styles.stripWeightRow}>
                    <Text style={styles.stripWeight} numberOfLines={1}>
                      {latestWeight != null ? `${latestWeight.toFixed(1)} kg` : 'Registrar'}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Pressable>
                <View style={styles.stripDivider} />
                <View style={[styles.stripZone, styles.stripZoneWater]}>
                  <Text style={styles.stripCaption}>
                    Agua · {glasses}/{WATER_TARGET}
                  </Text>
                  <View style={styles.dropletsCompact}>
                    {Array.from({ length: WATER_TARGET }).map((_, i) => (
                      <WaterGlass
                        key={i}
                        size={20}
                        filled={i < glasses}
                        onPress={() => tapDroplet(i)}
                        accessibilityLabel={`Agua, ${i + 1} de ${WATER_TARGET} vasos`}
                      />
                    ))}
                  </View>
                </View>
              </View>

              {items.length === 0 ? (
                /* New user, empty estela — no 1-tap path to lead with yet,
                 * so the AI methods ARE the primary action here. The slot
                 * pill is hidden (nothing to re-log against). */
                <>
                  <Text style={styles.empty}>
                    Aún no tienes tus de siempre. Registra una comida —con foto o describiéndola— y
                    la próxima la sumas en un toque.
                  </Text>
                  {methodsBlock}
                </>
              ) : (
                <>
                  {/* Lowest-effort path leads: the slot pill + 1-tap re-log
                   * of "lo de siempre" sit above the AI methods. */}
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

                  <Text style={styles.frequentLabel}>Lo de siempre</Text>
                  {items.map((item) => {
                    const confirming = confirmingName === item.name
                    const dimmed = confirmingName != null && !confirming
                    return (
                      <MealCard
                        key={item.name}
                        style={styles.cardGap}
                        elevated
                        compact
                        name={item.name}
                        protein={item.protein_g}
                        calories={item.calories}
                        state={confirming ? 'confirmed' : dimmed ? 'dimmed' : 'idle'}
                        onPress={() => handleLogMeal(item)}
                        disabled={confirmingName != null}
                      />
                    )
                  })}

                  {/* A meal that isn't in your estela yet — the AI methods,
                   * secondary to the 1-tap re-log above. */}
                  <Text style={styles.newMealLabel}>Una comida nueva</Text>
                  {methodsBlock}
                </>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

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
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  back: {
    fontFamily: typography.uiBold,
    fontSize: 26,
    lineHeight: 26,
    color: colors.niebla,
    width: 24,
  },
  backSpacer: {
    width: 24,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  close: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.niebla,
    width: 24,
    textAlign: 'right',
  },
  body: {
    maxHeight: BODY_MAX_H,
  },
  // Compact "Hoy" strip — peso (tappable) on the left, agua on the
  // right, split by a hairline. Lifts the meal list above the fold.
  strip: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginTop: 4,
  },
  stripZone: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 6,
  },
  stripZoneWater: {
    flex: 1,
  },
  stripDivider: {
    width: 1,
    marginVertical: 10,
    backgroundColor: colors.hairline,
  },
  stripCaption: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.magenta,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  stripWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stripWeight: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  chevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
  },
  dropletsCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // One stadium pill holding the four slot segments.
  typePill: {
    flexDirection: 'row',
    marginTop: 18,
    backgroundColor: colors.bgCard2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
  },
  typeSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 9,
    borderRadius: 22,
  },
  typeSegActive: {
    backgroundColor: colors.magentaTint,
  },
  typeSegText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 0.4,
  },
  frequentLabel: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    marginTop: 14,
    marginBottom: 10,
  },
  // Quieter eyebrow than "Lo de siempre" — marks the AI methods as the
  // secondary path. Upright (the italic serif is reserved for the
  // coach voice), so it reads as a plain UI section label.
  newMealLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 20,
    marginBottom: 10,
  },
  cardGap: {
    marginBottom: 6,
  },
  empty: {
    fontFamily: typography.ui,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.niebla,
    paddingVertical: 14,
  },
  // The two AI log methods — a side-by-side pair, secondary to the
  // 1-tap re-log above. Both share the same magenta-tinted tile (foto
  // and texto are peers, not a primary/secondary pair).
  methods: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  method: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
  },
  methodTile: {
    borderColor: colors.magentaTint2,
    backgroundColor: colors.magentaTint,
  },
  // Visual echo of the disabled state while a 1-tap re-log confirms.
  methodDimmed: {
    opacity: 0.4,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconPhoto: {
    backgroundColor: colors.magentaTint2,
  },
  methodLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  // ── Weight pane ──────────────────────────────────────────────────
  weightPane: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  primaryBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    letterSpacing: 0.3,
  },
})
