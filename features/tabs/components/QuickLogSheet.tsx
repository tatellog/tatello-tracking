import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { isCycleActive } from '@/features/cycle/phase'
import type { FrequentMeal, MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals } from '@/features/macros/hooks'
import { useProfile, useRecordLastPeriodStart } from '@/features/profile/hooks'
import { useAddMeasurement, useLastPeriodStart, useMeasurements } from '@/features/progress/hooks'
import { igniteDimension } from '@/features/orbit/ignitionBus'
import { toWeightPoints } from '@/features/progress/logic'
import { useSetWater, useWaterToday } from '@/features/water/hooks'
import {
  GLASS_ML,
  GOAL_STEP_ML,
  MAX_GOAL_ML,
  MIN_GOAL_ML,
  mlToLitresLabel,
  useWaterGoal,
} from '@/features/water/useWaterGoal'
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
 * reading as the cycle tracker. On the false→true transition it pops
 * once (scale) — a satisfying one-shot, the most-repeated action's
 * reward. Reduced motion shows the fill with no pop. */
function WaterGlass({
  filled,
  size = 26,
  onPress,
  accessibilityLabel,
  tick,
}: {
  filled: boolean
  size?: number
  onPress: () => void
  accessibilityLabel?: string
  /** Bumped by the parent on each tap. The pop fires only on a tap-driven
   *  fill — never when the day's count loads from the server on open. */
  tick: number
}) {
  const pop = useSharedValue(0)
  const reduce = useReducedMotion() ?? false
  const wasFilled = useRef(filled)
  const lastTick = useRef(tick)
  useEffect(() => {
    const tapped = tick !== lastTick.current
    if (filled && !wasFilled.current && tapped && !reduce) {
      pop.value = withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.inOut(Easing.sin) }),
      )
    }
    wasFilled.current = filled
    lastTick.current = tick
    // Reset on cleanup so an aborted pop (rapid taps) snaps back to rest
    // instead of freezing at an intermediate scale.
    return () => {
      cancelAnimation(pop)
      pop.value = 0
    }
  }, [filled, reduce, pop, tick])
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pop.value * 0.14 }] }))
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={style}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d={GLASS}
            fill={filled ? colors.magenta : 'none'}
            stroke={filled ? colors.magenta : colors.bruma}
            strokeWidth={1.7}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </Pressable>
  )
}

const SCREEN_W = Dimensions.get('window').width

/* A faint, STATIC celestial field behind the top of the sheet — a soft
 * warm gradient + a few oro/leche stars, so the sheet reads as part of
 * the observatory, not a flat card. Top band only (never over the
 * tappable content), no animation, pointer-transparent. */
function SheetSky() {
  return (
    <View style={styles.sky} pointerEvents="none">
      <LinearGradient colors={['#1E0C12', 'rgba(20,8,11,0)']} style={StyleSheet.absoluteFill} />
      <Svg width={SCREEN_W} height={170} style={StyleSheet.absoluteFill}>
        <Circle cx={SCREEN_W * 0.13} cy={34} r={1.2} fill={colors.leche} opacity={0.16} />
        <Circle cx={SCREEN_W * 0.84} cy={22} r={3.4} fill={colors.oro} opacity={0.05} />
        <Circle cx={SCREEN_W * 0.84} cy={22} r={1.5} fill={colors.oro} opacity={0.2} />
        <Circle cx={SCREEN_W * 0.68} cy={52} r={0.9} fill={colors.leche} opacity={0.12} />
        <Circle cx={SCREEN_W * 0.27} cy={70} r={1} fill={colors.oro} opacity={0.14} />
        <Circle cx={SCREEN_W * 0.93} cy={66} r={0.8} fill={colors.leche} opacity={0.1} />
        <Circle cx={SCREEN_W * 0.45} cy={28} r={0.7} fill={colors.leche} opacity={0.1} />
      </Svg>
    </View>
  )
}

/* The ✦ seal next to the sheet title — oro, static. Marks "this is
 * where you add to your sky" without a word. */
function StarSeal({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
        fill={color}
      />
    </Svg>
  )
}

/* The moon that anchors the cycle — its light grows from new (just the
 * ring) to full (a soft oro disc) via `lit` (0..1). Oro, never magenta
 * (that's the CTA/voice) nor red (cycle red line). Not a drop: it's the
 * start of a lunar arc, the same metaphor as CycleRing. */
function MoonAnchor({ lit, size = 22 }: { lit: number; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={7.5} fill={colors.oro} opacity={0.16 + lit * 0.5} />
      <Circle cx={12} cy={12} r={7.5} stroke={colors.oro} strokeWidth={1.1} opacity={0.85} />
      <Path
        d="M12 4.5 A 7.5 7.5 0 0 0 12 19.5"
        stroke={colors.oro}
        strokeWidth={0.8}
        opacity={(1 - lit) * 0.5}
      />
      <Circle cx={12} cy={12} r={1.3} fill={colors.oroLight} opacity={0.4 + lit * 0.4} />
    </Svg>
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

// A keyboard — signals "type what you ate" (the text-entry method).
function KeyboardIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={6} width={20} height={12} rx={2.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M6 10 H6.01 M10 10 H10.01 M14 10 H14.01 M18 10 H18.01 M8 14 H16"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
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
 *   - Comida → the AI scan methods lead, up top: Con foto (shoot/pick →
 *     scan-meal) and Con texto (type it → scan-meal describe mode).
 *     Below them, the slot pill + "Lo de siempre" 1-tap re-log. Manual
 *     entry of macros lives in the Comidas tab (MealComposer), not here.
 */
export function QuickLogSheet({ visible, onClose }: Props) {
  const router = useRouter()
  const today = useMemo(() => todayInTimezone(), [])

  // The sheet lives permanently in the tab bar, so gate its reads on
  // `visible` — no fetching/subscribing while it's closed. Cached data
  // (e.g. measurements, shared with Progreso) still shows instantly on
  // open; the rest fetches then.
  const { data: frequent } = useFrequentMeals(8, visible)
  const createMeal = useCreateMeal()
  const { data: measurements } = useMeasurements(90, visible)
  const addMeasurement = useAddMeasurement()
  const { data: glasses = 0 } = useWaterToday(today, visible)
  const setWater = useSetWater(today)
  const { goalMl, updateGoal } = useWaterGoal()

  // Cycle — only shown for users who track it. The period-start chip is
  // an eventual action (~1×/month), so it lives at the bottom, away from
  // the daily strip.
  const { data: profile } = useProfile()
  const cycleActive = isCycleActive(profile?.biological_sex, profile?.cycle_situation)
  const { data: lastPeriod } = useLastPeriodStart()
  const recordPeriod = useRecordLastPeriodStart()
  // A period spans several days. Once marked, keep the chip in its "anotado /
  // en curso" state through the menstrual window instead of resetting to the
  // "mark it" prompt the next day — which would also let the user overwrite
  // period_start mid-period and corrupt the cycle math.
  const PERIOD_WINDOW_DAYS = 5
  const daysSincePeriod = (() => {
    if (!lastPeriod) return null
    const [fy, fm, fd] = lastPeriod.split('-').map(Number)
    const [ty, tm, td] = today.split('-').map(Number)
    return Math.round(
      (Date.UTC(ty ?? 1970, (tm ?? 1) - 1, td ?? 1) -
        Date.UTC(fy ?? 1970, (fm ?? 1) - 1, fd ?? 1)) /
        86_400_000,
    )
  })()
  const periodOngoing =
    daysSincePeriod != null && daysSincePeriod >= 0 && daysSincePeriod < PERIOD_WINDOW_DAYS

  const [mode, setMode] = useState<Mode>('home')
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [confirmingName, setConfirmingName] = useState<string | null>(null)
  const [weightDraft, setWeightDraft] = useState<number | null>(null)
  const [editingGoal, setEditingGoal] = useState(false)
  // Bumped on each water tap so a glass pops only on a tap, not on load.
  const [waterTick, setWaterTick] = useState(0)

  const items = frequent ?? []

  // "Lo de siempre" — show the first 3, then a "Ver N más / Ver menos"
  // toggle so the long re-log list doesn't bury the meal-type segment +
  // manual log below. The chevron flips down (más) ↔ up (menos).
  const FREQUENT_PREVIEW = 3
  const [showAllFrequent, setShowAllFrequent] = useState(false)
  const chev = useSharedValue(0)
  const chevStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${90 + chev.value * 180}deg` }],
  }))
  const toggleShowAllFrequent = () => {
    chev.value = withTiming(showAllFrequent ? 0 : 1, { duration: 200 })
    setShowAllFrequent((v) => !v)
  }
  const hiddenFrequent = Math.max(0, items.length - FREQUENT_PREVIEW)

  // Glasses are a fixed 250 ml; the count = goal ÷ 250 (2 L → 8, 3 L → 12).
  const waterTarget = Math.max(1, Math.round(goalMl / GLASS_ML))
  // Shrink the glyphs as the count grows so they stay on one row.
  const glassSize = waterTarget <= 8 ? 20 : waterTarget <= 12 ? 16 : 13

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
      setEditingGoal(false)
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
    // Celestial payoff — shows on the screen behind once the sheet closes.
    igniteDimension('alimento')
    setTimeout(onClose, CONFIRM_HOLD_MS)
  }

  const tapDroplet = (index: number) => {
    Haptics.selectionAsync().catch(() => {})
    setWaterTick((t) => t + 1)
    // Tap a droplet to fill up to it; tap the current top one to step back.
    setWater.mutate(glasses === index + 1 ? index : index + 1)
  }

  // Marking the period start re-anchors the cycle to today — confirm so
  // an accidental tap can't reset a cycle that's mid-way.
  const onMarkPeriod = () => {
    if (periodOngoing) return
    showActionSheet(
      {
        title: '¿Tu período empezó hoy?',
        options: ['Sí, anótalo', 'Cancelar'],
        cancelButtonIndex: 1,
      },
      (i) => {
        if (i !== 0) return
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        recordPeriod.mutate(today)
      },
    )
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

  // Con texto — the scan-meal screen in describe mode: type what you ate,
  // the AI parses it into ingredients (same confirm form as the photo scan).
  const handleTextLog = () => {
    if (confirmingName != null) return
    onClose()
    router.push({ pathname: '/scan-meal', params: { describe: '1' } })
  }

  // The two AI methods — the headline way to log a meal, so they sit up
  // top and carry the magenta-tinted fill. Dimmed while a 1-tap re-log
  // confirms so the disabled state reads visually.
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
        accessibilityLabel="Registrar una comida escribiéndola"
      >
        <View style={[styles.methodIcon, styles.methodIconPhoto]}>
          <KeyboardIcon color={colors.magenta} />
        </View>
        <Text style={styles.methodLabel}>Con texto</Text>
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
          <SheetSky />
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
            <View style={styles.titleRow}>
              <StarSeal color={colors.oro} />
              <Text style={styles.title}>
                {mode === 'weight' ? 'Tu peso actual' : 'Registro rápido'}
              </Text>
            </View>
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
                  <Pressable
                    onPress={() => setEditingGoal((v) => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Ajustar tu meta de agua"
                  >
                    <Text style={styles.stripCaption}>
                      Agua · {mlToLitresLabel(glasses * GLASS_ML)} / {mlToLitresLabel(goalMl)} L
                    </Text>
                  </Pressable>
                  {editingGoal ? (
                    <View style={styles.goalStepper}>
                      <Pressable
                        onPress={() => updateGoal(goalMl - GOAL_STEP_ML)}
                        disabled={goalMl <= MIN_GOAL_ML}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Bajar meta de agua"
                        style={[styles.goalStep, goalMl <= MIN_GOAL_ML && styles.goalStepOff]}
                      >
                        <Text style={styles.goalStepSign}>−</Text>
                      </Pressable>
                      <Text style={styles.goalValue}>{mlToLitresLabel(goalMl)} L</Text>
                      <Pressable
                        onPress={() => updateGoal(goalMl + GOAL_STEP_ML)}
                        disabled={goalMl >= MAX_GOAL_ML}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Subir meta de agua"
                        style={[styles.goalStep, goalMl >= MAX_GOAL_ML && styles.goalStepOff]}
                      >
                        <Text style={styles.goalStepSign}>+</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditingGoal(false)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Listo"
                        style={styles.goalDoneBtn}
                      >
                        <Text style={styles.goalDoneText}>Listo</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.dropletsCompact}>
                      {Array.from({ length: waterTarget }).map((_, i) => (
                        <WaterGlass
                          key={i}
                          size={glassSize}
                          filled={i < glasses}
                          tick={waterTick}
                          onPress={() => tapDroplet(i)}
                          accessibilityLabel={`Agua, ${i + 1} de ${waterTarget} vasos`}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* ── Una comida nueva — the AI scan methods lead the meal
               * section, up top: photo scan + describe are the headline
               * way to log, before the 1-tap "lo de siempre" below. ── */}
              <Text style={styles.newMealLabel}>Una comida nueva</Text>
              {methodsBlock}

              {items.length === 0 ? (
                <Text style={styles.empty}>
                  Lo que registres aparecerá aquí como “lo de siempre”, para sumarlo en un toque.
                </Text>
              ) : (
                <>
                  {/* The slot pill sets the meal type for the 1-tap re-log. */}
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

                  {items.slice(0, FREQUENT_PREVIEW).map((item) => {
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

                  {showAllFrequent ? (
                    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
                      {items.slice(FREQUENT_PREVIEW).map((item) => {
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
                    </Animated.View>
                  ) : null}

                  {hiddenFrequent > 0 ? (
                    <Pressable
                      onPress={toggleShowAllFrequent}
                      style={styles.showMore}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllFrequent }}
                    >
                      <Text style={styles.showMoreText}>
                        {showAllFrequent ? 'Ver menos' : `Ver ${hiddenFrequent} más`}
                      </Text>
                      <Animated.Text style={[styles.showMoreChevron, chevStyle]}>›</Animated.Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {/* Cycle — eventual (~1×/month), so it sits last, quiet. Only
               * for users who track a cycle. Oro/luna, never clinical. */}
              {cycleActive ? (
                periodOngoing ? (
                  <View style={[styles.cycleChip, styles.cycleChipDone]}>
                    <MoonAnchor lit={1} />
                    <Text style={styles.cycleLabel}>
                      {daysSincePeriod === 0 ? 'Período anotado hoy' : 'Período en curso'}
                    </Text>
                    <Text style={styles.cycleCheck}>✓</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={onMarkPeriod}
                    style={styles.cycleChip}
                    accessibilityRole="button"
                    accessibilityLabel="Marcar que tu período empezó hoy"
                  >
                    <MoonAnchor lit={0} />
                    <Text style={styles.cycleLabel}>Hoy empezó mi período</Text>
                    <Text style={styles.cycleChevron}>›</Text>
                  </Pressable>
                )
              ) : null}
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
    // Darker scrim so the screen behind (e.g. the cycle ring) recedes and
    // the sheet is the clear focus.
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  anchor: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // No top hairline — the sheet separates from the scrim by its rounded
  // corners + a soft upward shadow, not a hard line.
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  // Cycle chip — full-width, oro, set apart at the bottom (eventual
  // action). Quiet in rest; reads as a celestial artifact, not a tracker.
  cycleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  cycleChipDone: {
    opacity: 0.85,
  },
  cycleLabel: {
    flex: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  cycleChevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
  },
  cycleCheck: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oro,
  },
  // Static celestial field, clipped to the sheet's rounded top, top band
  // only. Behind the grabber/header; never over the tappable content.
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 170,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
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
  // ✦ seal + title, centred together between the back-spacer and close.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
  // Inline goal stepper — replaces the glasses row while editing the
  // litres target. Same height band so the strip doesn't jump.
  goalStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalStep: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
  },
  goalStepOff: {
    opacity: 0.35,
  },
  goalStepSign: {
    fontFamily: typography.uiBold,
    fontSize: 17,
    lineHeight: 19,
    color: colors.magenta,
  },
  goalValue: {
    minWidth: 52,
    textAlign: 'center',
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  goalDoneText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  goalDoneBtn: {
    marginLeft: 'auto',
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
  // "Ver N más / Ver menos" — a quiet magenta action below the preview.
  showMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 2,
  },
  showMoreText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.magenta,
  },
  showMoreChevron: {
    // chevStyle: 90° (down → "ver más") ↔ 270° (up → "ver menos").
    fontFamily: typography.uiMedium,
    fontSize: 18,
    lineHeight: 18,
    color: colors.magenta,
  },
  // Quieter eyebrow than "Lo de siempre" — marks the AI methods as the
  // secondary path. Upright (the italic serif is reserved for the
  // coach voice), so it reads as a plain UI section label.
  newMealLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    // Oro eyebrow — "luz del cielo", consistent with the app's eyebrows.
    color: colors.oro,
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
