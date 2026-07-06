import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { OrbitLoader } from '@/components/OrbitLoader'
import { PrimaryCta } from '@/components/PrimaryCta'
import { StarLoader } from '@/components/StarLoader'
import {
  mealIngredients,
  mealPhotoUrl,
  uploadMealPhoto,
  type MealInput,
  type StoredIngredient,
} from '@/features/macros/api'
import {
  useCreateMeal,
  useFrequentMeals,
  useMealById,
  useUpdateMeal,
} from '@/features/macros/hooks'
import { mealMomentByHour } from '@/features/macros/meal-moment'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { useActiveLogDate } from '@/features/tabs/active-log-date'
import { subscribeUniverseDelta } from '@/features/tabs/universe-delta-bus'
import { ATTRIBUTE_LABEL } from '@/features/tabs/universe-rewards'
import { UNIVERSE_ACCENT } from '@/features/tabs/universe-visuals'
import {
  ingredientKcal,
  ingredientProtein,
  ingredientSugar,
  mealTotals,
  scanMeal,
  scanMealFromText,
  type ScanConfidence,
  type ScannedIngredient,
} from '@/features/meal-scan/scan'
import { SkyBackground } from '@/features/tabs/components'
import { useProfile } from '@/features/profile/hooks'
import { getWaterBreakdown, toStoredLiquids } from '@/features/water/api'
import {
  LiquidDetectionSheet,
  type LiquidAcceptPayload,
} from '@/features/water/components/LiquidDetectionSheet'
import { WaterFromMealsToast } from '@/features/water/components/WaterFromMealsToast'
import { useAddDirectWater, useMealHydration, useSaveMealHydration } from '@/features/water/hooks'
import {
  detectLiquids,
  liquidFactor,
  type LiquidDetection,
} from '@/features/water/liquid-detection'
import { track } from '@/lib/analytics'
import { emitScanFeedback } from '@/features/meal-scan/feedback-bus'
import { showActionSheet } from '@/lib/actionSheet'
import { resizeForDisplay } from '@/lib/image'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

// Mensaje legible de un error de registro: el primer issue de Zod (p.ej.
// "Máximo 31 días atrás") o el mensaje del error; nada de JSON crudo.
function mealErrorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'issues' in e) {
    const issues = (e as { issues?: { message?: string }[] }).issues
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message
  }
  return e instanceof Error ? e.message : 'Intenta de nuevo.'
}

// A small sparkle — the "destello" that marks the AI-powered badge.
function SparkleIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2 L13.8 9.2 L21 11 L13.8 12.8 L12 20 L10.2 12.8 L3 11 L10.2 9.2 Z"
        fill={color}
      />
      <Path
        d="M18.6 3 L19.3 5.7 L22 6.4 L19.3 7.1 L18.6 9.8 L17.9 7.1 L15.2 6.4 L17.9 5.7 Z"
        fill={color}
        opacity={0.65}
      />
    </Svg>
  )
}

// The status line cycles through these while the scan resolves — a
// sense of progress, even though the call is a single request.
const SCAN_STEPS = [
  'Escaneando tu plato…',
  'Identificando ingredientes…',
  'Estimando las porciones…',
  'Calculando tus macros…',
]

const PLATE = 200
const BEAM_H = 74

// The circular photo while it scans — a light bar sweeps down the
// plate and the image breathes, so the wait reads as live analysis.
function ScanPlate({ uri }: { uri: string }) {
  const breath = useSharedValue(0)
  const beam = useSharedValue(0)

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    beam.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(breath)
      cancelAnimation(beam)
    }
  }, [breath, beam])

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }))
  // The beam travels from fully above the plate to fully below it,
  // so the loop's reset happens off-screen and stays invisible.
  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -BEAM_H + beam.value * (PLATE + BEAM_H) }],
  }))

  return (
    <View style={styles.plate}>
      <Animated.Image source={{ uri }} style={[styles.plateImg, imgStyle]} resizeMode="cover" />
      <Animated.View style={[styles.beam, beamStyle]}>
        <LinearGradient
          colors={['transparent', colors.beamTint, 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.beamLine} />
      </Animated.View>
    </View>
  )
}

// The text-analyze plate — the no-photo counterpart of ScanPlate, so a
// describe-by-text scan is as visual as a photo scan. A dark disc with a
// breathing ✦ (the IA sigil) inside the same OrbitLoader ring.
function TextAnalyzePlate() {
  const breath = useSharedValue(0)
  const reduce = useReducedMotion() ?? false
  useEffect(() => {
    if (reduce) {
      breath.value = 0.5
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [reduce, breath])
  const starStyle = useAnimatedStyle(() => ({
    opacity: 0.7 + breath.value * 0.3,
    transform: [{ scale: 0.9 + breath.value * 0.18 }],
  }))
  return (
    <View style={[styles.plate, styles.textPlate]}>
      <Animated.View style={starStyle} pointerEvents="none">
        <Svg width={68} height={68} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 L13.4 10.6 L21 12 L13.4 13.4 L12 21 L10.6 13.4 L3 12 L10.6 10.6 Z"
            fill={colors.magentaHot}
          />
        </Svg>
      </Animated.View>
    </View>
  )
}

// A pencil — marks an editable field.
function PencilIcon({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20.2 L4.8 16 L16 4.8 L19.2 8 L8 19.2 Z M14.4 6.4 L17.6 9.6"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// A plus — the "add ingredient" affordance.
function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5 V19 M5 12 H19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  )
}

// A camera — add or change the meal photo.
function CameraIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

// A circular arrow — rescan the photo.
function RescanIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 12 A8 8 0 1 1 17.66 6.34"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M17.4 2.4 L17.66 6.34 L13.7 6.7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

// Coach lines for the reveal — about the ACT of logging and the day,
// never about the dish (the scan is mocked for now). Cormorant italic.
// Reviewed with voice-and-copy (v3.0): no judgement, no guilt, no push.
const REVEAL_LINES = [
  'Registrado. Tu día va tomando forma.',
  'Una comida más en tu cielo.',
  'Tu cielo te acompaña.',
  'Cada registro deja luz.',
  'Aquí sigues.',
  'Lo dejaste anotado. Eso ya es algo.',
]

// A faint asterism that breathes below the scanning plate — the germ of
// the constellation this meal will join. Decorative; magenta = the IA at
// work. Reduced motion parks it at a steady opacity.
function ConstellationSeed() {
  const pulse = useSharedValue(0)
  const reduce = useReducedMotion() ?? false
  useEffect(() => {
    if (reduce) {
      pulse.value = 0.5
      return
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(pulse)
  }, [reduce, pulse])
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.4 }))
  return (
    <Animated.View style={[styles.seed, style]} pointerEvents="none">
      <Svg width={200} height={80} viewBox="0 0 200 80" fill="none">
        <Path
          d="M28 22 L74 48 L120 30 L168 56"
          stroke={colors.magenta}
          strokeWidth={0.5}
          opacity={0.22}
        />
        <Circle cx={28} cy={22} r={1.6} fill={colors.magenta} opacity={0.5} />
        <Circle cx={74} cy={48} r={2.1} fill={colors.magenta} opacity={0.7} />
        <Circle cx={120} cy={30} r={1.4} fill={colors.magenta} opacity={0.45} />
        <Circle cx={168} cy={56} r={1.8} fill={colors.magenta} opacity={0.6} />
      </Svg>
    </Animated.View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const REVEAL_PLATE = 228
const REVEAL_RING_STROKE = 3.5
// 4-point star (48-viewBox) — the no-photo center + the burst sparkles.
const STAR_4 = 'M24 8 L26.6 21.4 L40 24 L26.6 26.6 L24 40 L21.4 26.6 L8 24 L21.4 21.4 Z'
// Angles (deg) the celebration sparkles fly out toward.
const BURST_ANGLES = [-90, -34, 22, 78, 134, 190, 246]

// One celebration sparkle that flies outward from the plate and fades.
// Driven by the shared `progress`; reduced motion keeps it hidden.
function BurstSparkle({
  progress,
  angle,
  reduce,
}: {
  progress: SharedValue<number>
  angle: number
  reduce: boolean
}) {
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const style = useAnimatedStyle(() => {
    const p = progress.value
    return {
      opacity: reduce ? 0 : p <= 0.02 ? 0 : (1 - p) * 0.9,
      transform: [
        { translateX: dx * p * 72 },
        { translateY: dy * p * 72 },
        { scale: 0.4 + p * 0.7 },
      ],
    }
  })
  return (
    <Animated.View style={[styles.burstSparkle, style]} pointerEvents="none">
      <Svg width={15} height={15} viewBox="0 0 48 48" fill="none">
        <Path d={STAR_4} fill={colors.oroLight} />
      </Svg>
    </Animated.View>
  )
}

// The reveal plate — the scanned photo (or a gold star) inside an oro ring
// that COMPLETES once, on a gold bloom, with a burst of sparkles. The scan
// theatre's spinning arc resolves here into a closed, golden "listo". A
// single forward animation; reduced motion shows it already arrived.
function RevealPlate({ uri }: { uri?: string }) {
  const fill = useSharedValue(0)
  const pop = useSharedValue(0)
  const burst = useSharedValue(0)
  const reduce = useReducedMotion() ?? false

  useEffect(() => {
    if (reduce) {
      fill.value = 1
      pop.value = 1
      burst.value = 0
      return
    }
    pop.value = withSequence(
      withTiming(1.04, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 260, easing: Easing.inOut(Easing.sin) }),
    )
    fill.value = withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })
    burst.value = withDelay(420, withTiming(1, { duration: 820, easing: Easing.out(Easing.quad) }))
    return () => {
      cancelAnimation(fill)
      cancelAnimation(pop)
      cancelAnimation(burst)
    }
  }, [reduce, fill, pop, burst])

  const c = REVEAL_PLATE / 2
  const r = c - REVEAL_RING_STROKE
  const circ = 2 * Math.PI * r

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - fill.value) }))
  const plateStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.4 + pop.value),
    transform: [{ scale: 0.82 + pop.value * 0.18 }],
  }))
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: fill.value * 0.55,
    transform: [{ scale: 0.7 + fill.value * 0.5 }],
  }))

  return (
    <View style={styles.revealPlateWrap}>
      <Animated.View style={[styles.revealBloom, bloomStyle]} pointerEvents="none" />
      <Svg width={REVEAL_PLATE} height={REVEAL_PLATE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.oro}
          strokeOpacity={0.16}
          strokeWidth={REVEAL_RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.oro}
          strokeOpacity={0.32}
          strokeWidth={REVEAL_RING_STROKE * 2.6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          animatedProps={ringProps}
          rotation={-90}
          originX={c}
          originY={c}
        />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={colors.oro}
          strokeWidth={REVEAL_RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          animatedProps={ringProps}
          rotation={-90}
          originX={c}
          originY={c}
        />
      </Svg>
      <Animated.View style={[styles.revealPlateInner, plateStyle]}>
        {uri ? (
          <Image source={{ uri }} style={styles.revealPhoto} resizeMode="cover" />
        ) : (
          <Svg width={72} height={72} viewBox="0 0 48 48" fill="none">
            <Circle cx={24} cy={24} r={11} fill={colors.oro} opacity={0.14} />
            <Path d={STAR_4} fill={colors.oro} />
            <Path
              d="M24 14 L25 22.9 L34 24 L25 25.1 L24 34 L23 25.1 L14 24 L23 22.9 Z"
              fill={colors.oroLeche}
              opacity={0.9}
            />
          </Svg>
        )}
      </Animated.View>
      {BURST_ANGLES.map((a) => (
        <BurstSparkle key={a} progress={burst} angle={a} reduce={reduce} />
      ))}
    </View>
  )
}

const SCREEN_W = Dimensions.get('window').width
// Photo column width inside the 20pt content padding, and the cap
// that keeps a tall (portrait) photo from dominating the screen.
const PHOTO_W = SCREEN_W - 40
// M1 · chips del escalador de porción (sobre los gramos del scan).
const PORTION_SCALES = [
  { label: '½', scale: 0.5, a11y: 'la mitad' },
  { label: '¾', scale: 0.75, a11y: 'tres cuartos' },
  { label: '1', scale: 1, a11y: 'completa' },
  { label: '1½', scale: 1.5, a11y: 'una y media' },
] as const

const PHOTO_MAX_H = 340

// Slot pre-selected by time of day — the user can change it in the
// picker before confirming. Helper COMPARTIDO (era el cuarto duplicado de
// los cortes por hora, y con los cortes viejos: comida moría a las 4pm).
const currentMealType = (): MealInput['meal_type'] => mealMomentByHour()

const MEAL_TYPE_VALUES: readonly MealInput['meal_type'][] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]

type MealType = MealInput['meal_type']

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Desayuno' },
  { value: 'lunch', label: 'Comida' },
  { value: 'dinner', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]

/* The celestial glyph for each meal slot — sunrise / sun / crescent /
 * sparkle. Same vocabulary as the quick-log slot pill. */
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

/*
 * Scan-a-meal flow. Opened with a photo uri: shows the "scanning"
 * theatre while scanMeal() (a dummy stub today) resolves, then a
 * confirm form — editable ingredient grams — that logs one meal.
 */
export default function ScanMealScreen() {
  const router = useRouter()
  const {
    uri,
    editId,
    manual,
    describe,
    photoPath,
    mealType: mealTypeParam,
  } = useLocalSearchParams<{
    uri?: string
    editId?: string
    manual?: string
    describe?: string
    /** Foto representativa del platillo (storage path) — fallback cuando la
     *  instancia editada no tiene foto propia (p.ej. un re-log sin foto). */
    photoPath?: string
    /** Momento elegido en el QuickLog ANTES de abrir el scan: la elección de
     *  la usuaria manda sobre el default por hora (antes se ignoraba y su
     *  "Snack" de madrugada aterrizaba como lo que la hora dijera). */
    mealType?: string
  }>()
  const isEdit = !!editId
  // Manual log — no scan, no ingredient breakdown; the user types the
  // protein + calories. The photo and name stay optional.
  const isManual = !!manual
  // Describe-by-AI — the user types what they ate; the AI parses it into
  // ingredients (same confirm form as the photo scan).
  const isDescribe = !!describe
  const createMeal = useCreateMeal()
  const updateMeal = useUpdateMeal()
  const editMeal = useMealById(editId)
  // Backfill: si Hoy está viendo un día pasado, la comida nueva se ancla a ESE
  // día (mediodía local), no a ahora. null = hoy normal.
  const activeLogDate = useActiveLogDate()
  const newMealConsumedAt = () => {
    if (!activeLogDate) return new Date()
    // Mediodía local del día visto, construido POR COMPONENTES (Hermes da
    // Invalid Date al parsear strings de fecha). Inline para no depender de un
    // export nuevo cruzando módulos (Fast Refresh a veces no lo levanta).
    const [y, m, d] = activeLogDate.split('-').map(Number) as [number, number, number]
    return new Date(y, m - 1, d, 12, 0, 0)
  }

  const [phase, setPhase] = useState<'describe' | 'scanning' | 'confirm' | 'reveal'>(
    isEdit || isManual ? 'confirm' : isDescribe ? 'describe' : 'scanning',
  )
  // The reveal state (state C) — protein of the just-logged meal + the
  // coach line, shown after a new log before returning to the tab.
  const [revealProtein, setRevealProtein] = useState(0)
  const [revealLine, setRevealLine] = useState(REVEAL_LINES[0] ?? '')
  // Warm in-app note when the scan can't read the plate/text (replaces a
  // cold system Alert). Cleared once the user adds an ingredient.
  const [scanError, setScanError] = useState<string | null>(null)

  // El delta de Energía que el universo emitió por ESTA comida. El
  // optimistic patch de useCreateMeal lo dispara desde Hoy (montado bajo
  // esta ruta), y lo mostramos en el reveal: cierra la cadena comida →
  // universo en el flujo principal, donde el toast global queda detrás de
  // esta pantalla y no se ve. Una comida = una subida de Energía, así que
  // acumular el único delta de la sesión basta (no hay re-log aquí).
  const [energiaDelta, setEnergiaDelta] = useState(0)
  useEffect(() => {
    return subscribeUniverseDelta(({ key, delta }) => {
      if (key === 'energia' && delta > 0) setEnergiaDelta((d) => d + delta)
    })
  }, [])
  const [description, setDescription] = useState('')
  const [photoUri, setPhotoUri] = useState(uri)
  const [aspect, setAspect] = useState(1.4)
  const [name, setName] = useState('')
  // La elección del QuickLog manda sobre el default por hora (si vino).
  const [mealType, setMealType] = useState<MealType>(() =>
    mealTypeParam != null && (MEAL_TYPE_VALUES as readonly string[]).includes(mealTypeParam)
      ? (mealTypeParam as MealType)
      : currentMealType(),
  )
  const [ingredients, setIngredients] = useState<ScannedIngredient[]>([])
  const [proteinInput, setProteinInput] = useState('')
  const [caloriesInput, setCaloriesInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  // In edit mode, true once the user attaches a new photo — so save
  // knows to upload it rather than keep the meal's existing one.
  const [photoChanged, setPhotoChanged] = useState(false)
  const populatedRef = useRef(false)
  // M1 · honestidad de evidencia: cuánto confió el modelo en su lectura.
  const [confidence, setConfidence] = useState<ScanConfidence>('alta')
  // M1 · escalador de porción de un tap: gramos ORIGINALES del scan por id
  // (la escala siempre se aplica sobre la base, no sobre sí misma).
  const baseGramsRef = useRef<Map<string, number>>(new Map())
  const [portionScale, setPortionScale] = useState(1)

  // ── Detección de líquidos → hidratación ────────────────────────────
  // Tras guardar la comida, si tiene bebidas/alimentos líquidos, ofrecemos
  // sumar su aporte al agua del día (con confirmación, nunca en silencio).
  const profileQ = useProfile()
  const liquidsEnabled = profileQ.data?.count_liquids_from_meals !== false
  const saveHydration = useSaveMealHydration()
  const addDirectWater = useAddDirectWater()
  // La decisión previa de esta comida (solo en edit) — para recalcular o
  // limpiar su aporte si dejó de tener líquidos.
  const priorHydrationQ = useMealHydration(editId)
  // El contexto de la hoja: qué comida, qué día, qué se detectó, agua actual,
  // y a dónde seguir (reveal en nuevas, volver en edición).
  const [liquidCtx, setLiquidCtx] = useState<{
    mealId: string
    intakeDate: string
    detection: LiquidDetection
    currentGlasses: number
    isEdit: boolean
    proceed: () => void
  } | null>(null)
  // El toast "✦ +N vaso desde comidas" sobre el reveal.
  const [waterToast, setWaterToast] = useState({ glasses: 0, seq: 0 })
  // Caso "agua pura por el escáner de comida": no se crea comida; el agua
  // entra como directa. Mostramos la misma hoja para confirmar, pero al
  // aceptar sumamos a water_intake y salimos sin reveal de comida.
  const [pureWaterCtx, setPureWaterCtx] = useState<{
    detection: LiquidDetection
    intakeDate: string
    currentGlasses: number
  } | null>(null)

  // Photo scan whenever we (re-)enter the scanning phase — skipped in
  // edit / manual / describe modes (describe runs the text scan on submit).
  useEffect(() => {
    if (isEdit || isManual || isDescribe || phase !== 'scanning') return
    let alive = true
    scanMeal(photoUri ?? '')
      .then((meal) => {
        if (!alive) return
        setName(meal.name)
        setIngredients(meal.ingredients)
        setConfidence(meal.confidence)
        baseGramsRef.current = new Map(meal.ingredients.map((i) => [i.id, i.grams]))
        setPortionScale(1)
        setPhase('confirm')
      })
      .catch(() => {
        // Vision failed (network / key / unreadable photo) — never leave
        // the user stuck in the scanning theatre. Fall to the confirm form
        // with a warm in-app note (not a cold system Alert).
        if (!alive) return
        setScanError('Esta foto se me complicó. Cuéntame qué hay en tu plato y lo anotamos juntas.')
        setPhase('confirm')
      })
    return () => {
      alive = false
    }
  }, [isEdit, isManual, isDescribe, phase, photoUri])

  // Describe-by-AI submit — parse the typed description into ingredients,
  // then drop into the same confirm form. Reuses the scanning theatre.
  // M1 · un tap = "comí la mitad / más": escala TODOS los ingredientes
  // detectados desde sus gramos originales (los agregados a mano no tienen
  // base y se respetan tal cual; un gramo editado a mano se re-deriva de la
  // base solo si vuelves a tocar un chip).
  const applyPortionScale = (scale: number) => {
    Haptics.selectionAsync().catch(() => {})
    setPortionScale(scale)
    setIngredients((prev) =>
      prev.map((i) => {
        const base = baseGramsRef.current.get(i.id)
        return base == null ? i : { ...i, grams: Math.max(1, Math.round(base * scale)) }
      }),
    )
    track('scan_portion_scaled', { scale })
  }

  const handleDescribeSubmit = () => {
    const text = description.trim()
    if (text.length < 2 || phase === 'scanning') return
    Haptics.selectionAsync().catch(() => {})
    setPhase('scanning')
    scanMealFromText(text)
      .then((meal) => {
        setName(meal.name)
        setIngredients(meal.ingredients)
        setConfidence(meal.confidence)
        baseGramsRef.current = new Map(meal.ingredients.map((i) => [i.id, i.grams]))
        setPortionScale(1)
        setPhase('confirm')
      })
      .catch(() => {
        setScanError('No alcancé a leerlo. Ajusta los ingredientes o agrégalos tú.')
        setPhase('confirm')
      })
  }

  // Edit mode — fill the form from the meal once it loads. The ref
  // gates it to a single run so a refetch can't clobber edits; a meal
  // with no stored ingredients becomes one synthetic ingredient.
  useEffect(() => {
    if (!isEdit || populatedRef.current || !editMeal.data) return
    populatedRef.current = true
    const m = editMeal.data
    setName(m.name)
    setMealType(m.meal_type as MealType)
    const stored = mealIngredients(m)
    setIngredients(
      stored
        ? stored.map((ing, i) => ({ ...ing, id: `ing-${i}` }))
        : [
            {
              id: 'ing-0',
              name: m.name,
              grams: 100,
              proteinPer100: Number(m.protein_g),
              kcalPer100: m.calories,
            },
          ],
    )
    // La foto de esta comida; si la instancia no tiene (un re-log sin
    // foto), cae a la foto representativa del platillo que llegó por
    // navegación — la misma que muestra la estela.
    const storedPhoto = m.photo_storage_path ?? photoPath
    if (storedPhoto) setPhotoUri(mealPhotoUrl(storedPhoto))
  }, [isEdit, editMeal.data, photoPath])

  // The reveal auto-dismisses after the star has settled — the user can
  // also tap the checkmark to leave sooner. With a screen reader or
  // reduced motion on, we do NOT auto-dismiss (2.4s isn't enough to read
  // the confirmation aloud); the user closes it themselves. We announce
  // the result either way.
  useEffect(() => {
    if (phase !== 'reveal') return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    AccessibilityInfo.announceForAccessibility(
      `Comida registrada. ${revealProtein} gramos de proteína.`,
    )
    Promise.all([
      AccessibilityInfo.isScreenReaderEnabled(),
      AccessibilityInfo.isReduceMotionEnabled(),
    ])
      .then(([screenReader, reduceMotion]) => {
        if (cancelled || screenReader || reduceMotion) return
        timer = setTimeout(() => router.back(), 2400)
      })
      .catch(() => {
        if (!cancelled) timer = setTimeout(() => router.back(), 2400)
      })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [phase, router, revealProtein])

  // Advance the status line while scanning, holding on the last step.
  useEffect(() => {
    if (isEdit || isManual || phase !== 'scanning') return
    setStepIndex(0)
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, SCAN_STEPS.length - 1))
    }, 1600)
    return () => clearInterval(id)
  }, [isEdit, isManual, phase])

  // Read the photo's real proportions so it can be shown uncropped.
  useEffect(() => {
    if (!photoUri) return
    let alive = true
    Image.getSize(
      photoUri,
      (w, h) => {
        if (alive && h > 0) setAspect(w / h)
      },
      () => {},
    )
    return () => {
      alive = false
    }
  }, [photoUri])

  const totals = useMemo(() => mealTotals(ingredients), [ingredients])

  // Photo box — full width, but a tall photo is capped and centred.
  let photoW = PHOTO_W
  let photoH = PHOTO_W / aspect
  if (photoH > PHOTO_MAX_H) {
    photoH = PHOTO_MAX_H
    photoW = PHOTO_MAX_H * aspect
  }

  const setGrams = (id: string, raw: string) => {
    const grams = Number(raw.replace(/[^0-9]/g, '')) || 0
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, grams } : i)))
  }
  const setIngredientName = (id: string, text: string) => {
    setIngredients((prev) => prev.map((i) => (i.id === id ? { ...i, name: text } : i)))
  }
  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id))
  }
  const addIngredient = () => {
    Haptics.selectionAsync().catch(() => {})
    setScanError(null)
    setIngredients((prev) => [
      ...prev,
      // Placeholder per-100 macros — a real food-database lookup
      // wires in here later; for now the user edits name + grams.
      { id: `ing-${Date.now()}`, name: '', grams: 100, proteinPer100: 8, kcalPer100: 150 },
    ])
  }

  // Pick a photo. On a fresh scan it re-runs the scan; in edit mode it
  // just attaches the photo, to be uploaded on save.
  const pickPhoto = async (source: 'camera' | 'library') => {
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
    const asset = result.assets[0]
    setPhotoUri(await resizeForDisplay(asset.uri, asset.width))
    if (isEdit) setPhotoChanged(true)
    // In describe mode the photo is just an attachment to the customizable
    // form — never trigger the photo-scan theatre (its effect is gated out
    // for describe and would hang on "scanning" forever).
    else if (!isManual && !isDescribe) setPhase('scanning')
  }

  // Tap the photo (or the placeholder) — change it. A fresh scan also
  // offers to re-run the scan on the same photo.
  const photoOptions = () => {
    const attachOnly = isEdit || isManual || isDescribe
    const options = attachOnly
      ? ['Tomar foto', 'Elegir de galería', 'Cancelar']
      : ['Reescanear esta foto', 'Tomar otra foto', 'Elegir de galería', 'Cancelar']
    showActionSheet(
      { title: 'Foto del platillo', options, cancelButtonIndex: options.length - 1 },
      (i) => {
        if (attachOnly) {
          if (i === 0) void pickPhoto('camera')
          else if (i === 1) void pickPhoto('library')
        } else if (i === 0) {
          setPhase('scanning')
        } else if (i === 1) {
          void pickPhoto('camera')
        } else if (i === 2) {
          void pickPhoto('library')
        }
      },
    )
  }

  // ¿Era su PRIMERA comida de la vida? Snapshot al montar (tras guardar, la
  // query de frecuentes se refresca y ya no sabría distinguirlo). Alimenta
  // la línea de compounding: el registro más caro del producto (primer scan,
  // 60-90 s) debe anunciar su recompensa — que mañana cuesta un toque.
  const frequent = useFrequentMeals(1)
  const hadMealsBefore = useRef<boolean | null>(null)
  if (hadMealsBefore.current === null && frequent.data !== undefined) {
    hadMealsBefore.current = frequent.data.length > 0
  }

  // New logs land on the reveal (state C) before returning to the tab —
  // a star joins the sky + the protein of this meal + a coach line.
  const goToReveal = (protein: number) => {
    setRevealProtein(Math.round(protein))
    setRevealLine(
      // La primera comida de la vida cierra con la promesa del día 2, no
      // con una frase genérica: convierte el esfuerzo en compounding.
      hadMealsBefore.current === false
        ? 'Guardada. La próxima vez está a un toque en ✦.'
        : (REVEAL_LINES[Math.floor(Math.random() * REVEAL_LINES.length)] ?? REVEAL_LINES[0]!),
    )
    setPhase('reveal')
  }

  // El día (local) al que cuenta una comida nueva: el día visto en backfill, o hoy.
  const intakeDateForNew = () => activeLogDate ?? todayInTimezone()

  /*
   * ¿Lo que se va a registrar es agua/té PURO? En ese caso no es una comida:
   * no creamos meal (no prende Energía) y lo sumamos como agua directa.
   *
   * Regla CONSERVADORA (un caldo/sopa/jugo es COMIDA que además hidrata, NO
   * agua pura): solo cuenta como agua pura si el NOMBRE mismo es un líquido al
   * 100% (agua / té / infusión / agua mineral / agua con limón) Y casi no
   * aporta nutrición (calorías ~0 y proteína ~0). Así "caldo de pollo" (caldo
   * = 50%, con pollo) crea su comida normal y además ofrece su agua.
   * Devuelve true si tomó el control del guardado (el caller debe `return`).
   */
  const tryPureWater = async (calories: number, protein: number): Promise<boolean> => {
    if (!liquidsEnabled) return false
    const mealName = name.trim() || 'Comida'
    // El nombre TIENE que ser un líquido 100% por sí mismo (no caldo/sopa/jugo).
    if (liquidFactor(mealName) !== 1) return false
    if (calories >= 10 || protein >= 2) return false
    const detection = detectLiquids({
      name: mealName,
      ingredients: ingredients.map((i) => ({ name: i.name, grams: i.grams })),
    })
    if (detection.items.length === 0) return false
    const intakeDate = intakeDateForNew()
    let currentGlasses = 0
    try {
      currentGlasses = (await getWaterBreakdown(intakeDate)).total
    } catch {
      // Sin red: la hoja muestra el "N →" desde 0; el agua igual se suma.
    }
    track('liquids_detected', {
      detected_items: detection.items.map((i) => i.label),
      total_water_estimate: detection.totalGlasses,
      pure_water: true,
    })
    setSaving(false)
    setPureWaterCtx({ detection, intakeDate, currentGlasses })
    return true
  }

  const handlePureWaterAccept = async (payload: LiquidAcceptPayload) => {
    const ctx = pureWaterCtx
    if (!ctx) return
    setPureWaterCtx(null)
    // water_intake es int → redondeamos a vasos enteros (mín. 1).
    const added = Math.max(1, Math.round(payload.totalGlasses))
    try {
      await addDirectWater.mutateAsync({ date: ctx.intakeDate, delta: added })
      track('liquids_accepted', { water_added: added, pure_water: true })
    } catch {
      // best-effort
    }
    // El alza de Claridad se ve al volver a Hoy (toast de delta del universo).
    router.back()
  }

  const handlePureWaterReject = () => {
    setPureWaterCtx(null)
    track('liquids_rejected', { pure_water: true })
    router.back()
  }

  /*
   * Tras guardar una comida, decide si ofrecer el aporte de líquidos. Si el
   * ajuste está apagado o no hay líquidos, sigue derecho (`proceed`). En
   * edición sin líquidos, limpia un aporte previo (el agua baja con
   * explicación: el delta de Claridad re-sincroniza al volver). Si hay
   * líquidos, abre la hoja de confirmación.
   */
  const presentLiquids = async (
    mealId: string,
    intakeDate: string,
    isEditFlow: boolean,
    proceed: () => void,
  ) => {
    if (!liquidsEnabled) {
      proceed()
      return
    }
    const detection = detectLiquids({
      name: name.trim() || 'Comida',
      ingredients: ingredients.map((i) => ({ name: i.name, grams: i.grams })),
    })
    const prior = isEditFlow ? priorHydrationQ.data : null
    if (detection.items.length === 0) {
      // Editó y ya no hay líquidos: retira el aporte que esta comida tenía.
      if (isEditFlow && prior && prior.glasses > 0) {
        try {
          await saveHydration.mutateAsync({
            mealId,
            intakeDate,
            glasses: 0,
            status: 'rejected',
            items: [],
          })
        } catch {
          // El agua derivada es best-effort; el registro de comida ya quedó.
        }
      }
      proceed()
      return
    }
    track('liquids_detected', {
      meal_id: mealId,
      detected_items: detection.items.map((i) => i.label),
      total_water_estimate: detection.totalGlasses,
    })
    // Agua actual del día SIN el aporte previo de esta comida (para el "N → N").
    let currentGlasses = 0
    try {
      const breakdown = await getWaterBreakdown(intakeDate)
      currentGlasses = Math.max(0, breakdown.total - (prior?.glasses ?? 0))
    } catch {
      // Sin red: la hoja muestra el "N →" desde 0; el aporte igual se guarda.
    }
    setLiquidCtx({ mealId, intakeDate, detection, currentGlasses, isEdit: isEditFlow, proceed })
  }

  const handleLiquidAccept = async (payload: LiquidAcceptPayload) => {
    const ctx = liquidCtx
    if (!ctx) return
    setLiquidCtx(null)
    try {
      await saveHydration.mutateAsync({
        mealId: ctx.mealId,
        intakeDate: ctx.intakeDate,
        glasses: payload.totalGlasses,
        status: 'accepted',
        items: toStoredLiquids(payload.items),
      })
      track('liquids_accepted', { water_added: payload.totalGlasses })
      if (payload.edited) {
        track('liquids_edited', {
          original_amount: ctx.detection.totalGlasses,
          final_amount: payload.totalGlasses,
        })
      }
      // El toast vive sobre el reveal (nuevas). En edición, el delta de
      // Claridad al volver es la confirmación.
      if (!ctx.isEdit && payload.totalGlasses > 0) {
        setWaterToast((t) => ({ glasses: payload.totalGlasses, seq: t.seq + 1 }))
      }
    } catch {
      // best-effort: el agua no se sumó pero la comida ya quedó registrada.
    }
    ctx.proceed()
  }

  const handleLiquidReject = async () => {
    const ctx = liquidCtx
    if (!ctx) return
    setLiquidCtx(null)
    try {
      await saveHydration.mutateAsync({
        mealId: ctx.mealId,
        intakeDate: ctx.intakeDate,
        glasses: 0,
        status: 'rejected',
        items: toStoredLiquids(ctx.detection.items),
      })
      track('liquids_rejected', { meal_id: ctx.mealId })
    } catch {
      // best-effort
    }
    ctx.proceed()
  }

  const handleConfirm = async () => {
    if (saving) return
    if (isManual) {
      if (!proteinInput.trim() || !caloriesInput.trim()) return
    } else if (ingredients.length === 0) {
      return
    }
    setSaving(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

    // Manual log — macros typed by hand, no ingredient breakdown.
    if (isManual) {
      // Agua/té puro tecleado a mano: lo sumamos como agua, no como comida.
      if (
        await tryPureWater(
          Math.min(5000, Math.max(0, Math.round(Number(caloriesInput) || 0))),
          Math.min(500, Math.max(0, Number(proteinInput) || 0)),
        )
      )
        return
      let manualPhoto: string | undefined
      if (photoUri) {
        try {
          manualPhoto = await uploadMealPhoto(photoUri)
        } catch (e) {
          console.warn('[scan-meal] photo upload failed', e)
          Alert.alert(
            'Tu comida quedó registrada',
            'La foto no alcanzó a subir, pero lo que importa ya está anotado.',
          )
        }
      }
      createMeal.mutate(
        {
          name: name.trim() || 'Comida',
          // Clamp to the schema's accepted range so a typo can't make
          // the insert reject silently.
          protein_g: Math.min(500, Math.max(0, Number(proteinInput) || 0)),
          calories: Math.min(5000, Math.max(0, Math.round(Number(caloriesInput) || 0))),
          consumed_at: newMealConsumedAt(),
          meal_type: mealType,
          photo_storage_path: manualPhoto,
        },
        {
          onSuccess: (meal) => {
            const protein = Math.min(500, Math.max(0, Number(proteinInput) || 0))
            void presentLiquids(meal.id, intakeDateForNew(), false, () => goToReveal(protein))
          },
          onError: (e) => {
            setSaving(false)
            Alert.alert('No pudimos registrar tu comida', mealErrorMessage(e))
          },
        },
      )
      return
    }

    const storedIngredients: StoredIngredient[] = ingredients.map(
      ({ name: ingName, grams, proteinPer100, kcalPer100, sugarPer100 }) => ({
        name: ingName,
        grams,
        proteinPer100,
        kcalPer100,
        sugarPer100,
      }),
    )
    const macros = {
      name: name.trim() || 'Comida',
      protein_g: Math.round(totals.protein * 10) / 10,
      calories: Math.round(totals.calories),
    }

    // Edit — update the meal in place, keeping its time.
    if (isEdit && editMeal.data) {
      // Upload only a freshly-attached photo; otherwise the meal keeps
      // whatever photo it already had.
      let photoPath: string | undefined
      if (photoChanged && photoUri) {
        try {
          photoPath = await uploadMealPhoto(photoUri)
        } catch (e) {
          console.warn('[scan-meal] photo upload failed', e)
          Alert.alert(
            'Tu comida quedó actualizada',
            'La foto no alcanzó a subir, pero tus cambios ya están guardados.',
          )
        }
      }
      updateMeal.mutate(
        {
          id: editMeal.data.id,
          input: {
            ...macros,
            consumed_at: new Date(editMeal.data.consumed_at),
            meal_type: mealType,
            ingredients: storedIngredients,
            ...(photoPath ? { photo_storage_path: photoPath } : {}),
          },
        },
        {
          onSuccess: () => {
            const m = editMeal.data!
            // meal_date es columna generada (no null en la práctica); fallback a hoy.
            void presentLiquids(m.id, m.meal_date ?? todayInTimezone(), true, () => router.back())
          },
          onError: () => setSaving(false),
        },
      )
      return
    }

    // Agua/té puro escaneado/descrito: lo sumamos como agua directa, no como
    // comida (no prende Energía). Solo si el NOMBRE es agua/té 100% y casi sin
    // nutrición (un caldo/sopa/jugo NO entra: es comida que además hidrata).
    if (await tryPureWater(macros.calories, macros.protein_g)) return

    // Create — upload the photo first (best effort; the meal saves
    // either way, but a failed upload is surfaced, not lost silently).
    let photoPath: string | undefined
    if (photoUri) {
      try {
        photoPath = await uploadMealPhoto(photoUri)
      } catch (e) {
        console.warn('[scan-meal] photo upload failed', e)
        Alert.alert('Foto', 'No pudimos guardar la foto, pero sí registramos la comida.')
      }
    }
    createMeal.mutate(
      {
        ...macros,
        consumed_at: newMealConsumedAt(),
        meal_type: mealType,
        photo_storage_path: photoPath,
        ingredients: storedIngredients,
      },
      {
        onSuccess: (meal) => {
          // Loop de corrección M1: solo para comidas que nacieron de un scan
          // (foto/texto) — el toast global pregunta "¿le atiné?" al volver.
          if (!isManual && !isEdit) {
            emitScanFeedback({ id: meal.id, name: macros.name, confidence })
          }
          void presentLiquids(meal.id, intakeDateForNew(), false, () =>
            goToReveal(macros.protein_g),
          )
        },
        onError: (e) => {
          setSaving(false)
          Alert.alert('No pudimos registrar tu comida', mealErrorMessage(e))
        },
      },
    )
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {isEdit && !editMeal.data ? (
          <View style={styles.scanning}>
            <View style={styles.scanCenter}>
              <StarLoader size={40} />
            </View>
          </View>
        ) : phase === 'describe' ? (
          <View style={styles.describeWrap}>
            <View style={styles.describeHeaderRow}>
              <Text style={styles.describeTitle}>Describe tu comida</Text>
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 6 L18 18 M18 6 L6 18"
                    stroke={colors.bone}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
            <Text style={styles.describeHint}>
              Escríbelo como lo dirías. Ej: 2 huevos revueltos con pan tostado y café.
            </Text>
            <TextInput
              style={styles.describeInput}
              value={description}
              onChangeText={setDescription}
              placeholder="¿Qué comiste?"
              placeholderTextColor={colors.niebla}
              multiline
              autoFocus
              textAlignVertical="top"
            />
            <Pressable
              onPress={handleDescribeSubmit}
              disabled={description.trim().length < 2}
              style={[styles.describeCta, description.trim().length < 2 && styles.describeCtaOff]}
              accessibilityRole="button"
              accessibilityLabel="Analizar lo que escribiste"
            >
              <SparkleIcon color={colors.leche} />
              <Text style={styles.describeCtaLabel}>Analizar</Text>
            </Pressable>
          </View>
        ) : phase === 'scanning' ? (
          <View style={styles.scanning}>
            <View style={styles.scanCenter}>
              {photoUri ? (
                <OrbitLoader size={228}>
                  <ScanPlate uri={photoUri} />
                </OrbitLoader>
              ) : (
                <OrbitLoader size={228}>
                  <TextAnalyzePlate />
                </OrbitLoader>
              )}
              <View style={styles.scanLabelSlot}>
                <Animated.Text
                  key={stepIndex}
                  entering={FadeIn.duration(420)}
                  exiting={FadeOut.duration(300)}
                  style={styles.scanText}
                >
                  {SCAN_STEPS[stepIndex]}
                </Animated.Text>
              </View>
              <ConstellationSeed />
            </View>
            <View style={styles.scanFooter}>
              <SparkleIcon color={colors.magenta} />
              <Text style={styles.scanBadgeText}>Powered by IA</Text>
            </View>
          </View>
        ) : phase === 'reveal' ? (
          <View style={styles.reveal}>
            <WaterFromMealsToast glasses={waterToast.glasses} seq={waterToast.seq} />
            <RevealPlate uri={photoUri} />
            <Animated.Text entering={FadeInUp.duration(520).delay(700)} style={styles.revealLine}>
              {revealLine}
            </Animated.Text>
            <Animated.View entering={FadeInUp.duration(520).delay(900)} style={styles.revealMacro}>
              <Text style={styles.revealMacroLabel}>Proteína · </Text>
              <Text style={styles.revealMacroValue}>{revealProtein}g</Text>
            </Animated.View>
            {/* "✦ +N Energía" — ata esta comida a tu universo, aquí donde
                el toast global queda detrás de la pantalla del reveal. */}
            {energiaDelta > 0 ? (
              <Animated.Text
                entering={FadeInUp.duration(520).delay(1000)}
                style={[styles.revealEnergia, { color: UNIVERSE_ACCENT.energia }]}
              >
                ✦ +{energiaDelta} {ATTRIBUTE_LABEL.energia}
              </Animated.Text>
            ) : null}
            {/* El puente registro → significado: en el momento de máxima
                atención, la respuesta a "¿cómo voy?" queda a un tap. La
                evidencia vive en Órbita Día (sin semáforo en el home). */}
            <Animated.View entering={FadeInUp.duration(520).delay(1150)}>
              <Pressable
                onPress={() => {
                  requestOrbitSegment('dia')
                  router.replace('/orbit')
                }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Ver cómo va tu día en Órbita"
              >
                <Text style={styles.revealOrbitaLink}>Ver cómo va tu día ›</Text>
              </Pressable>
            </Animated.View>
            <Animated.View entering={FadeInUp.duration(520).delay(1100)}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={16}
                style={styles.revealCheck}
                accessibilityRole="button"
                accessibilityLabel="Listo, volver a la pantalla anterior"
              >
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 13 L10 18 L19 7"
                    stroke={colors.oro}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M6 6 L18 18 M18 6 L6 18"
                    stroke={colors.bone}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              {scanError ? (
                <Animated.View entering={FadeIn.duration(400)} style={styles.scanErrorNote}>
                  <Text style={styles.scanErrorText}>{scanError}</Text>
                </Animated.View>
              ) : null}

              {photoUri ? (
                <Pressable
                  onPress={photoOptions}
                  style={[styles.photoWrap, { width: photoW, height: photoH }]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isEdit || isManual || isDescribe
                      ? 'Cambiar la foto'
                      : 'Reescanear o cambiar la foto'
                  }
                >
                  <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                  <View style={styles.photoChip}>
                    {isEdit || isManual || isDescribe ? (
                      <CameraIcon color={colors.leche} size={14} />
                    ) : (
                      <RescanIcon color={colors.leche} />
                    )}
                    <Text style={styles.photoChipText}>
                      {isEdit || isManual || isDescribe ? 'Cambiar foto' : 'Reescanear'}
                    </Text>
                  </View>
                </Pressable>
              ) : isEdit || isManual || isDescribe ? (
                <Pressable
                  onPress={photoOptions}
                  style={styles.photoPlaceholder}
                  accessibilityRole="button"
                  accessibilityLabel="Agregar una foto del platillo"
                >
                  <CameraIcon color={colors.magenta} size={28} />
                  <Text style={styles.photoPlaceholderText}>Agregar foto</Text>
                </Pressable>
              ) : null}

              <Text style={styles.eyebrow}>Tu platillo</Text>
              <View style={styles.nameField}>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre del platillo"
                  placeholderTextColor={colors.niebla}
                />
                <PencilIcon color={colors.niebla} />
              </View>

              <Text style={[styles.eyebrow, styles.eyebrowGap]}>Momento</Text>
              <View style={styles.slotPill}>
                {MEAL_TYPES.map((mt) => {
                  const active = mt.value === mealType
                  // Oro (not magenta) — the moment of day is sky/light,
                  // distinct from magenta which is the IA's voice.
                  const tint = active ? colors.oro : colors.niebla
                  return (
                    <Pressable
                      key={mt.value}
                      onPress={() => setMealType(mt.value)}
                      style={[styles.slotSeg, active && styles.slotSegActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={mt.label}
                    >
                      <MealGlyph type={mt.value} color={tint} />
                      <Text style={[styles.slotSegText, { color: tint }]}>{mt.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              {isManual ? (
                <>
                  <Text style={[styles.eyebrow, styles.eyebrowGap]}>Macros</Text>
                  <View style={styles.row}>
                    <Text style={styles.macroLabel}>Proteína</Text>
                    <View style={[styles.gramsBox, styles.macroBox]}>
                      <TextInput
                        style={styles.gramsInput}
                        value={proteinInput}
                        onChangeText={(t) => setProteinInput(t.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        placeholderTextColor={colors.niebla}
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                      <Text style={styles.gramsUnit}>g</Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.macroLabel}>Calorías</Text>
                    <View style={[styles.gramsBox, styles.macroBox]}>
                      <TextInput
                        style={styles.gramsInput}
                        value={caloriesInput}
                        onChangeText={(t) => setCaloriesInput(t.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        placeholderTextColor={colors.niebla}
                        keyboardType="numeric"
                        returnKeyType="done"
                      />
                      <Text style={styles.gramsUnit}>kcal</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.eyebrow, styles.eyebrowGap]}>
                    {isEdit ? 'Ingredientes' : 'Ingredientes detectados'}
                  </Text>

                  {/* M1 · honestidad de evidencia: cuando el modelo dudó, se
                      dice — jamás fingir precisión. */}
                  {!isEdit && confidence !== 'alta' ? (
                    <Text style={styles.confidenceNote}>
                      {confidence === 'media'
                        ? 'Leímos tu plato, pero las porciones son un estimado. Dales un vistazo.'
                        : 'No estamos seguros de este plato. Revisa lo que encontramos.'}
                    </Text>
                  ) : null}

                  {/* M1 · porción de un tap: "comí la mitad" sin teclado. */}
                  {!isEdit && ingredients.length > 0 ? (
                    <View style={styles.portionRow}>
                      <Text style={styles.portionLabel}>Porción</Text>
                      {PORTION_SCALES.map((p) => {
                        const active = portionScale === p.scale
                        return (
                          <Pressable
                            key={p.label}
                            onPress={() => applyPortionScale(p.scale)}
                            style={[styles.portionChip, active && styles.portionChipActive]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`Porción ${p.a11y}`}
                          >
                            <Text
                              style={[styles.portionChipText, active && styles.portionChipTextOn]}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  ) : null}
                  {ingredients.map((ing) => (
                    <View key={ing.id} style={styles.row}>
                      <View style={styles.ingMain}>
                        <TextInput
                          style={styles.ingName}
                          value={ing.name}
                          onChangeText={(t) => setIngredientName(ing.id, t)}
                          placeholder="Ingrediente"
                          placeholderTextColor={colors.niebla}
                        />
                        <Text style={styles.ingMacros}>
                          {Math.round(ingredientProtein(ing))} g proteína ·{' '}
                          {Math.round(ingredientKcal(ing))} kcal
                          {ingredientSugar(ing) >= 1
                            ? ` · ${Math.round(ingredientSugar(ing))} g azúcar`
                            : ''}
                        </Text>
                      </View>
                      <View style={styles.gramsBox}>
                        <TextInput
                          style={styles.gramsInput}
                          value={String(ing.grams)}
                          onChangeText={(t) => setGrams(ing.id, t)}
                          keyboardType="numeric"
                          returnKeyType="done"
                        />
                        <Text style={styles.gramsUnit}>g</Text>
                      </View>
                      <Pressable
                        onPress={() => removeIngredient(ing.id)}
                        hitSlop={8}
                        style={styles.removeBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar ${ing.name || 'ingrediente'}`}
                      >
                        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M6 6 L18 18 M18 6 L6 18"
                            stroke={colors.niebla}
                            strokeWidth={2.4}
                            strokeLinecap="round"
                          />
                        </Svg>
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    onPress={addIngredient}
                    style={styles.addBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar un ingrediente"
                  >
                    <PlusIcon color={colors.magenta} />
                    <Text style={styles.addBtnText}>Agregar ingrediente</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>

            <View style={styles.footer}>
              {isManual ? null : (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>En total</Text>
                  <Text style={styles.totalValue}>
                    <Text style={styles.totalNum}>{Math.round(totals.protein)}</Text> g proteína
                    {'   ·   '}
                    <Text style={styles.totalNum}>{Math.round(totals.calories)}</Text> kcal
                    {totals.sugar >= 1 ? (
                      <>
                        {'   ·   '}
                        <Text style={styles.totalNum}>{Math.round(totals.sugar)}</Text> g azúcar
                      </>
                    ) : null}
                  </Text>
                </View>
              )}
              {!isEdit && activeLogDate ? (
                <Text style={styles.backfillNote}>
                  Esto se guarda en el{' '}
                  <Text style={styles.backfillDate}>
                    {Number(activeLogDate.slice(8, 10))}/{activeLogDate.slice(5, 7)}
                  </Text>
                </Text>
              ) : null}
              <PrimaryCta
                label={isEdit ? 'Guardar' : 'Confirmar'}
                onPress={handleConfirm}
                disabled={
                  isManual
                    ? !proteinInput.trim() || !caloriesInput.trim()
                    : ingredients.length === 0
                }
                loading={saving}
                loadingLabel="Guardando…"
              />
            </View>
          </>
        )}
      </SafeAreaView>

      {liquidCtx ? (
        <LiquidDetectionSheet
          visible
          detection={liquidCtx.detection}
          currentGlasses={liquidCtx.currentGlasses}
          onAccept={handleLiquidAccept}
          onReject={handleLiquidReject}
        />
      ) : null}

      {pureWaterCtx ? (
        <LiquidDetectionSheet
          visible
          detection={pureWaterCtx.detection}
          currentGlasses={pureWaterCtx.currentGlasses}
          onAccept={handlePureWaterAccept}
          onReject={handlePureWaterReject}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  // Aviso de backfill — la comida cae en el día visto, no en hoy.
  backfillNote: {
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  backfillDate: {
    fontFamily: typography.uiBold,
    color: colors.oroLeche,
    fontVariant: ['tabular-nums'],
  },
  // ── scanning ───────────────────────────────────────────────────────
  scanning: {
    flex: 1,
  },
  // Photo + status, centred in the free space above the footer.
  scanCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
  // The constellation germ under the scanning plate.
  seed: {
    marginTop: 4,
  },
  // ── reveal (state C) ───────────────────────────────────────────────
  reveal: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 32,
  },
  revealPlateWrap: {
    width: REVEAL_PLATE,
    height: REVEAL_PLATE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Gold "listo" bloom behind the plate — a soft glowing disc.
  revealBloom: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.oroTint,
    shadowColor: colors.oro,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 44,
    elevation: 6,
  },
  revealPlateInner: {
    width: 196,
    height: 196,
    borderRadius: 98,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  revealPhoto: {
    width: '100%',
    height: '100%',
  },
  burstSparkle: {
    position: 'absolute',
  },
  revealLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: typography.sizes.headingLg * 1.3,
    color: colors.leche,
    textAlign: 'center',
  },
  revealMacro: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  revealMacroLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  revealMacroValue: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.title,
    color: colors.leche,
  },
  // El delta del universo — "✦ +N Energía", tintado del atributo.
  revealEnergia: {
    marginTop: 8,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  // El puente a Órbita Día — secundario al check de "listo", nunca compite.
  revealOrbitaLink: {
    marginTop: 16,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  // A round gold "done" stamp — reads as confirmed, not as a nav/tab
  // button (a circle + checkmark, no stadium pill).
  revealCheck: {
    marginTop: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroTint,
    borderWidth: 1,
    borderColor: colors.oroHairline,
  },
  // Warm in-app note when the scan couldn't read the photo/text.
  scanErrorNote: {
    backgroundColor: colors.oroTint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  scanErrorText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.sizes.bodyLarge * 1.3,
    color: colors.leche,
  },
  plate: {
    width: PLATE,
    height: PLATE,
    borderRadius: PLATE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard,
  },
  // The text-analyze plate centers its breathing ✦.
  textPlate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateImg: {
    ...StyleSheet.absoluteFillObject,
  },
  // The light bar that sweeps down the plate.
  beam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: BEAM_H,
  },
  beamLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BEAM_H / 2 - 1,
    height: 2,
    backgroundColor: colors.beamLine,
  },
  // Fixed-height slot so the rotating status never shifts layout.
  scanLabelSlot: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  // "Powered by IA" — anchored as a footer.
  scanFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 12,
  },
  scanBadgeText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // ── describe (escritura por IA) ────────────────────────────────────
  describeWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  describeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  describeTitle: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  describeHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
    marginTop: 4,
    marginBottom: 18,
  },
  describeInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
    lineHeight: 24,
  },
  describeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: colors.magenta,
  },
  describeCtaOff: {
    opacity: 0.4,
  },
  describeCtaLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  // ── confirm ────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  // The photo — shown whole at its own aspect ratio, tappable to
  // reescanear or swap. Width/height are set inline.
  photoWrap: {
    alignSelf: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.bruma,
    marginBottom: 4,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoChip: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.scrim,
  },
  photoChipText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  // No-photo placeholder — a dashed slot inviting a meal photo.
  photoPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  photoPlaceholderText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  eyebrowGap: {
    marginTop: 22,
  },

  // M1 · nota de duda del modelo — honesta, en calma, nunca alarma.
  confidenceNote: {
    marginTop: 2,
    marginBottom: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.bone,
  },
  // M1 · escalador de porción de un tap.
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  portionLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginRight: 2,
  },
  portionChip: {
    minWidth: 44,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bgCard2,
  },
  portionChipActive: {
    borderColor: colors.magenta,
    backgroundColor: colors.magentaTint2,
  },
  portionChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  portionChipTextOn: {
    color: colors.magentaHot,
  },
  // The dish name — a field, not a heading, so it reads as editable.
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  nameInput: {
    flex: 1,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.heading,
    color: colors.leche,
    letterSpacing: -0.3,
    padding: 0,
  },
  // Slot picker — one stadium pill with the four meal-moment segments.
  slotPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
  },
  slotSeg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 9,
    borderRadius: 22,
  },
  slotSegActive: {
    backgroundColor: colors.oroTint,
  },
  slotSegText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    marginBottom: 8,
  },
  ingMain: {
    flex: 1,
    minWidth: 0,
  },
  ingName: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    letterSpacing: -0.2,
    padding: 0,
  },
  ingMacros: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  gramsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 9,
    paddingHorizontal: 10,
    height: 38,
    minWidth: 64,
  },
  gramsInput: {
    flex: 1,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    textAlign: 'right',
    padding: 0,
  },
  gramsUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Manual macros — a label + a number box per row (protein / kcal).
  macroLabel: {
    flex: 1,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    letterSpacing: -0.2,
  },
  macroBox: {
    minWidth: 104,
  },
  // "Agregar ingrediente" — a dashed slot signalling an open row.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 2,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // Footer — total + CTA, pinned together below the list.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  totalNum: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
})
