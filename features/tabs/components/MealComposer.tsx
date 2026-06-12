import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { memo, useEffect, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
import { uploadMealPhoto, type FrequentMeal, type MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals } from '@/features/macros/hooks'
import { igniteDimension } from '@/features/orbit/ignitionBus'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { showActionSheet } from '@/lib/actionSheet'
import { resizeForDisplay } from '@/lib/image'
import { colors, typography } from '@/theme'

import { MealCard } from './MealCard'
import { SectionHeader } from './SectionHeader'

const HISTORY_LIMIT = 24
// Estela compacta por defecto · muestra estas y "Ver todas" para el resto.
const COLLAPSED_COUNT = 4
const CONFIRM_MS = 1000
// 4-point star — the shared glyph.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
// Trail rail — a continuous magenta line down the left with each
// meal's star sitting on it. Star size scales with how often the meal
// is logged (freq), so staples read as bright anchor-stars and rare
// foods as small faint ones — the trail is a map of your eating.
const RAIL_WIDTH = 34
const LINE_WIDTH = 1.5
const MIN_STAR = 9
const MAX_STAR = 20
// Gap between meal cards. The trail line extends into it so the
// constellation stays continuous across the cards.
const ROW_GAP = 8
// New-meal preview star.
const PREVIEW_STAR = 19

type MealType = MealInput['meal_type']

function currentMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

// A camera — the "agregar foto del platillo" affordance.
function CameraIcon({ color, size = 18 }: { color: string; size?: number }) {
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

// A keyboard — the "registrar con texto" affordance (AI describe mode).
function KeyboardIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

/* A star on the estela trail. Size + brightness scale with how often
 * the meal is logged — staples become bright anchor-stars, rare foods
 * stay small and faint. The head (most-logged / most-recent meal)
 * glows and breathes, like the head of a comet.
 *
 * Memoized: its props are primitives, so it skips re-render when the
 * list re-renders for an unrelated reason (e.g. a +-tap toggling one
 * row's confirmed state). */
const TrailStar = memo(function TrailStar({
  size,
  glow,
  isHead,
}: {
  size: number
  glow: number
  isHead: boolean
}) {
  // Gated on screen-active: Comidas never unmounts (detachInactiveScreens=
  // false), so the comet-head breath ticked forever off-tab. Inactive →
  // settle at mid-breath; active → resume the identical loop.
  const active = useScreenActive()
  const breath = useSharedValue(0)
  useEffect(() => {
    if (!isHead) return
    if (!active) {
      cancelAnimation(breath)
      breath.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.quad) })
      return
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [isHead, breath, active])

  const starStyle = useAnimatedStyle(() => ({
    opacity: (isHead ? 0.9 : glow) + breath.value * 0.1,
    transform: [{ scale: 1 + breath.value * 0.12 }],
  }))

  return (
    <View style={styles.starWrap} pointerEvents="none">
      {isHead ? <View style={styles.starHalo} /> : null}
      <Animated.View style={starStyle}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.magenta} />
        </Svg>
      </Animated.View>
    </View>
  )
})

/* The new-meal preview star — it kindles as the form fills (name is
 * already typed, so progress tracks the two macro fields) and, once
 * the meal is valid, twinkles. A quiet promise of "sumar al cielo". */
function StarPreview({ progress, valid }: { progress: number; valid: boolean }) {
  // Gated on screen-active: a half-filled form left behind kept this
  // twinkle looping off-tab forever. Inactive → settle at mid-twinkle.
  const active = useScreenActive()
  const lit = useSharedValue(0)
  const tw = useSharedValue(0)

  useEffect(() => {
    lit.value = withTiming(progress, { duration: 420, easing: Easing.out(Easing.cubic) })
  }, [progress, lit])

  useEffect(() => {
    if (valid && active) {
      tw.value = withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    } else if (valid) {
      cancelAnimation(tw)
      tw.value = withTiming(0.5, { duration: 300 })
    } else {
      cancelAnimation(tw)
      tw.value = withTiming(0, { duration: 300 })
    }
    return () => cancelAnimation(tw)
  }, [valid, tw, active])

  const starStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + lit.value * 0.52 + tw.value * 0.28,
    transform: [{ scale: 0.72 + lit.value * 0.2 + tw.value * 0.1 }],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: lit.value * 0.45 + tw.value * 0.4,
  }))

  return (
    <View style={styles.previewWrap} pointerEvents="none">
      <Animated.View style={[styles.previewGlow, glowStyle]} />
      <Animated.View style={starStyle}>
        <Svg width={PREVIEW_STAR} height={PREVIEW_STAR} viewBox="0 0 24 24">
          <Path d={STAR_PATH} fill={colors.magenta} />
        </Svg>
      </Animated.View>
    </View>
  )
}

type Props = {
  /** Open a history entry in the meal editor (same screen as the Hoy
   *  tab's "Comidas de hoy" — edits the most recent meal of that name).
   *  photoPath: la foto representativa del platillo, para que el editor la
   *  muestre aunque la instancia abierta no tenga foto propia. */
  onOpenMeal: (id: string, photoPath?: string) => void
}

/*
 * The Comidas tab's add + history block — two distinct sections:
 *
 *   "Sumar comida" — the search/create field. Type to filter the
 *      estela below; type something new and the editor appears.
 *   "Tu estela"    — your constellation of logged meals: a continuous
 *      trail of light whose stars grow brighter the more a meal is
 *      eaten. NOT today's meals (those are "Comidas de hoy" on the Hoy
 *      tab). Each row: "+" logs it now; tap the row opens it in the
 *      meal editor on its most recent logged instance.
 */
export function MealComposer({ onOpenMeal }: Props) {
  const { data: foods } = useFrequentMeals(HISTORY_LIMIT)
  const createMeal = useCreateMeal()
  const router = useRouter()

  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [calories, setCalories] = useState('')
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const q = name.trim().toLowerCase()
  const composing = q.length > 0

  const history = useMemo(() => {
    const all = foods ?? []
    if (!q) return all
    return all
      .filter((f) => f.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1
        return ap - bp
      })
  }, [foods, q])

  const exactMatch = history.some((f) => f.name.toLowerCase() === q)
  const proteinNum = parseFloat(protein)
  const caloriesNum = parseInt(calories, 10)
  const manualValid =
    name.trim().length >= 2 &&
    Number.isFinite(proteinNum) &&
    proteinNum >= 0 &&
    Number.isFinite(caloriesNum) &&
    caloriesNum > 0
  // Preview-star fill — the name is already typed, so the remaining
  // signal is the two macro fields.
  const previewProgress = ((protein.trim() ? 1 : 0) + (calories.trim() ? 1 : 0)) / 2

  // When the "nueva comida" editor closes (name cleared, or it became an
  // exact match), drop any staged photo so it can't resurface on a
  // different meal name later.
  useEffect(() => {
    if (!composing || exactMatch) setPhotoUri(null)
  }, [composing, exactMatch])

  // Compactada por defecto; al buscar se muestran todas las coincidencias.
  // Las magnitudes de estrella siguen calculándose sobre la lista completa
  // (escala estable aunque compactes).
  const collapsible = !composing && history.length > COLLAPSED_COUNT
  const visible = collapsible && !expanded ? history.slice(0, COLLAPSED_COUNT) : history

  // Trail magnitudes — each star's size maps the meal's log frequency
  // onto [MIN_STAR, MAX_STAR] relative to the rest of the estela.
  const n = visible.length
  const { minFreq, freqSpan } = useMemo(() => {
    const freqs = history.map((h) => h.freq)
    const min = freqs.length ? Math.min(...freqs) : 0
    return { minFreq: min, freqSpan: (freqs.length ? Math.max(...freqs) : 0) - min }
  }, [history])
  const starCount = (foods ?? []).length

  const clear = () => {
    setName('')
    setProtein('')
    setCalories('')
    setPhotoUri(null)
  }

  // Re-log a known meal — fast path, no photo step (it keeps whatever
  // photo the original logged instance had via the frequent-meal row).
  const log = (meal: {
    name: string
    protein_g: number
    calories: number
    photo_storage_path?: string | null
  }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    igniteDimension('alimento')
    createMeal.mutate({
      name: meal.name,
      protein_g: meal.protein_g,
      calories: meal.calories,
      consumed_at: new Date(),
      meal_type: currentMealType(),
      // Conserva la foto del platillo en el re-log, igual que el quick-log
      // de Hoy · evita que la instancia nueva quede sin foto.
      photo_storage_path: meal.photo_storage_path ?? undefined,
    })
  }

  const handleLogRow = (item: FrequentMeal) => {
    if (confirmed) return
    log({
      name: item.name,
      protein_g: item.protein_g,
      calories: item.calories,
      photo_storage_path: item.photo_storage_path,
    })
    setConfirmed(item.name)
    setTimeout(() => setConfirmed((c) => (c === item.name ? null : c)), CONFIRM_MS)
  }

  // ── Registro rápido con IA — hand off to the /scan-meal flow (the
  //    same entry points the Hoy tab's QuickLog uses). Distinct from the
  //    manual-editor photo below (which only attaches an image). ──

  // Con foto: shoot/pick, then let scan-meal read the plate and log it.
  const openScanPhoto = async (source: 'camera' | 'library') => {
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
    router.push({ pathname: '/scan-meal', params: { uri: result.assets[0].uri } })
  }

  const handleScanPhoto = () => {
    showActionSheet(
      {
        title: 'Registrar comida con foto',
        options: ['Tomar foto', 'Elegir de la galería', 'Cancelar'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) void openScanPhoto('camera')
        else if (i === 1) void openScanPhoto('library')
      },
    )
  }

  // Con texto: scan-meal in describe mode — type what you ate, AI parses it.
  const handleScanText = () => {
    router.push({ pathname: '/scan-meal', params: { describe: '1' } })
  }

  const pickImage = async (source: 'camera' | 'library') => {
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
  }

  const photoOptions = () => {
    const options = photoUri
      ? ['Tomar otra foto', 'Elegir de galería', 'Quitar foto', 'Cancelar']
      : ['Tomar foto', 'Elegir de galería', 'Cancelar']
    showActionSheet(
      {
        title: 'Foto del platillo',
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: photoUri ? 2 : undefined,
      },
      (i) => {
        if (i === 0) void pickImage('camera')
        else if (i === 1) void pickImage('library')
        else if (photoUri && i === 2) setPhotoUri(null)
      },
    )
  }

  const handleAddManual = async () => {
    if (!manualValid || submitting) return
    setSubmitting(true)
    // Upload the dish photo first (best-effort — a failed upload still
    // logs the meal, just without the image).
    let photoPath: string | undefined
    if (photoUri) {
      try {
        photoPath = await uploadMealPhoto(photoUri)
      } catch (e) {
        console.warn('[meal-composer] photo upload failed', e)
        Alert.alert('Foto', 'No pudimos guardar la foto, pero sí registramos la comida.')
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    createMeal.mutate(
      {
        name: name.trim(),
        protein_g: proteinNum,
        calories: caloriesNum,
        consumed_at: new Date(),
        meal_type: currentMealType(),
        photo_storage_path: photoPath,
      },
      {
        onSuccess: () => {
          igniteDimension('alimento')
          clear()
          setSubmitting(false)
        },
        onError: () => setSubmitting(false),
      },
    )
  }

  return (
    <View>
      {/* ── Sumar comida — the search / create field. ── */}
      <SectionHeader label="Sumar comida" />

      {/* AI quick-log — foto + texto entry points (hand off to scan-meal),
          sitting above the search so they're the headline way to register. */}
      <View style={styles.methods}>
        <Pressable
          onPress={handleScanPhoto}
          style={[styles.method, styles.methodTile]}
          accessibilityRole="button"
          accessibilityLabel="Registrar una comida con foto"
        >
          <View style={styles.methodIcon}>
            <CameraIcon color={colors.magenta} size={20} />
          </View>
          <Text style={styles.methodLabel}>Con foto</Text>
        </Pressable>
        <Pressable
          onPress={handleScanText}
          style={[styles.method, styles.methodTile]}
          accessibilityRole="button"
          accessibilityLabel="Registrar una comida escribiéndola"
        >
          <View style={styles.methodIcon}>
            <KeyboardIcon color={colors.magenta} />
          </View>
          <Text style={styles.methodLabel}>Con texto</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchField}
        value={name}
        onChangeText={setName}
        placeholder="Busca o agrega una comida…"
        placeholderTextColor={colors.niebla}
        autoCorrect={false}
        returnKeyType="next"
      />

      {composing && !exactMatch ? (
        <View style={styles.editor}>
          {/* Header — names the mode (you're creating, not searching)
              and carries the preview star that kindles as you fill. */}
          <View style={styles.editorHead}>
            <EyebrowLabel tone="magenta" size={10}>
              Nueva comida
            </EyebrowLabel>
            <StarPreview progress={previewProgress} valid={manualValid} />
          </View>
          {/* The typed name is its own title line — never embedded in
              the hint sentence, so a long name truncates cleanly
              instead of wrapping mid-prose. */}
          <Text style={styles.newName} numberOfLines={1}>
            {name.trim()}
          </Text>
          <Text style={styles.newHint}>
            Aún no está en tu cielo. Asígnale su proteína y calorías.
          </Text>

          <View style={styles.numberRow}>
            <View style={styles.fieldCol}>
              <EyebrowLabel tone="niebla" size={9} style={styles.fieldLabel}>
                Proteína
              </EyebrowLabel>
              <View style={styles.numberField}>
                <TextInput
                  style={styles.numberInput}
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  placeholderTextColor={colors.bruma}
                  keyboardType="numeric"
                  returnKeyType="next"
                />
                <Text style={styles.numberUnit}>g</Text>
              </View>
            </View>
            <View style={styles.fieldCol}>
              <EyebrowLabel tone="niebla" size={9} style={styles.fieldLabel}>
                Calorías
              </EyebrowLabel>
              <View style={styles.numberField}>
                <TextInput
                  style={styles.numberInput}
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="0"
                  placeholderTextColor={colors.bruma}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <Text style={styles.numberUnit}>kcal</Text>
              </View>
            </View>
          </View>

          {/* Optional dish photo — same affordance as the scan-meal flow,
              so a manually-created meal can carry its image too. */}
          {photoUri ? (
            <Pressable
              onPress={photoOptions}
              style={styles.photoRow}
              accessibilityRole="button"
              accessibilityLabel="Cambiar o quitar la foto del platillo"
            >
              <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
              <Text style={styles.photoRowText}>Foto añadida · toca para cambiar</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={photoOptions}
              style={styles.photoPlaceholder}
              accessibilityRole="button"
              accessibilityLabel="Agregar una foto del platillo"
            >
              <CameraIcon color={colors.magenta} />
              <Text style={styles.photoPlaceholderText}>Agregar foto</Text>
            </Pressable>
          )}

          <PrimaryCta
            label={submitting ? 'Sumando…' : 'Sumar al cielo'}
            variant="soft"
            onPress={handleAddManual}
            disabled={!manualValid || submitting}
            marginTop={14}
            accessibilityLabel="Registrar comida nueva"
          />
        </View>
      ) : null}

      {/* ── Tu estela — your constellation of logged meals. ── */}
      <View style={styles.estelaHead}>
        <EyebrowLabel tone="magenta" size={10}>
          Tu estela
        </EyebrowLabel>
        {starCount > 0 ? (
          <Text style={styles.estelaCount}>
            {starCount} {starCount === 1 ? 'comida' : 'comidas'}
          </Text>
        ) : null}
      </View>

      <View style={styles.list}>
        {visible.map((item, i) => {
          const isConfirmed = confirmed === item.name
          const norm = freqSpan === 0 ? 1 : (item.freq - minFreq) / freqSpan
          const starSize = MIN_STAR + norm * (MAX_STAR - MIN_STAR)
          const starGlow = 0.4 + norm * 0.6
          // The trail fades down toward the tail; halves of the line
          // are clipped at the head/last star so it begins and ends on
          // a star rather than running off the section.
          const lineOpacity = n <= 1 ? 0 : 0.6 - (i / (n - 1)) * 0.5
          return (
            <View key={item.name} style={styles.row}>
              {/* Trail rail — the continuous line + this meal's star. */}
              <View style={styles.rail}>
                {n > 1 ? (
                  <View
                    style={[
                      styles.trailLine,
                      {
                        opacity: lineOpacity,
                        top: i === 0 ? '50%' : 0,
                        bottom: i === n - 1 ? '50%' : -ROW_GAP,
                      },
                    ]}
                  />
                ) : null}
                <TrailStar size={starSize} glow={starGlow} isHead={i === 0} />
              </View>

              <MealCard
                style={styles.cardFlex}
                name={item.name}
                protein={item.protein_g}
                calories={item.calories}
                freq={item.freq}
                photoPath={item.photo_storage_path}
                state={isConfirmed ? 'confirmed' : 'idle'}
                onPress={() => handleLogRow(item)}
                onCardPress={() => onOpenMeal(item.id, item.photo_storage_path ?? undefined)}
              />
            </View>
          )
        })}

        {history.length === 0 ? (
          <Text style={styles.emptyHint}>
            {composing
              ? 'Nada con ese nombre, créala arriba.'
              : 'Tu estela está vacía. La comida que sumes aparecerá aquí.'}
          </Text>
        ) : null}
      </View>

      {collapsible ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.showMore}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Mostrar menos comidas' : 'Mostrar todas tus comidas'}
        >
          <Text style={styles.showMoreText}>
            {expanded ? 'Ver menos' : `Ver todas · ${history.length}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // AI quick-log tiles — the two headline entry points above the search.
  methods: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
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
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint2,
  },
  methodLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.3,
  },
  searchField: {
    height: 46,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  estelaHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 6,
  },
  estelaCount: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  list: {
    marginTop: 2,
  },
  // Row stretches to the section width; the "+" is a flex child at
  // the end, so it pins to the right edge without absolute tricks.
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: ROW_GAP,
  },
  rail: {
    width: RAIL_WIDTH,
    position: 'relative',
  },
  // The continuous trail line — top/bottom are set per row so it
  // begins and ends on a star. Opacity fades toward the tail.
  trailLine: {
    position: 'absolute',
    left: (RAIL_WIDTH - LINE_WIDTH) / 2,
    width: LINE_WIDTH,
    backgroundColor: colors.magenta,
  },
  // Centres the star — any size — on the rail line.
  starWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The comet head's halo.
  starHalo: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.magentaTint2,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
    elevation: 3,
  },
  // Lets the shared MealCard fill the row beside the trail rail.
  cardFlex: {
    flex: 1,
  },
  emptyHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    paddingVertical: 10,
  },
  // "Ver todas / Ver menos" — expande la estela compactada.
  showMore: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  showMoreText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // The new-meal form — a contained card so the mode-shift (search →
  // create) reads as a distinct, deliberate step.
  editor: {
    marginTop: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    padding: 14,
  },
  editorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  // The new meal's name — its own line, a clean title. Truncates if
  // long; the full text still lives in the field above.
  newName: {
    fontFamily: typography.displaySemi,
    fontSize: 19,
    color: colors.leche,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  // Instruction copy — fixed text, now quieter since the name above
  // carries the emphasis.
  newHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginTop: 3,
    marginBottom: 14,
  },
  numberRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldCol: {
    flex: 1,
  },
  // Label sits above the box so it persists once a number is typed —
  // an inside-the-box label would vanish on first keystroke.
  fieldLabel: {
    marginLeft: 2,
    marginBottom: 6,
  },
  numberField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 11,
    paddingHorizontal: 12,
  },
  numberInput: {
    flex: 1,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  numberUnit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // No-photo affordance — a quiet dashed slot, compact so it fits the
  // inline editor without competing with the macro fields.
  photoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    marginTop: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.magenta,
    letterSpacing: 0.3,
  },
  // Attached-photo row — a thumbnail + a "tap to change" line.
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  photoRowText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  previewWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGlow: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.magentaTint2,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 7,
    elevation: 3,
  },
})
