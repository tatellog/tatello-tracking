import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
import type { FrequentMeal, MealInput } from '@/features/macros/api'
import { useCreateMeal, useFrequentMeals } from '@/features/macros/hooks'
import { colors, typography } from '@/theme'

import { SectionHeader } from './SectionHeader'

const HISTORY_LIMIT = 24
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
// The "+" — a quiet ghost circle at the row's end; it lights up
// solid only on confirm, so the star trail stays the protagonist.
const ADD_BTN = 34
const ADD_GAP = 10
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

/* A star on the estela trail. Size + brightness scale with how often
 * the meal is logged — staples become bright anchor-stars, rare foods
 * stay small and faint. The head (most-logged / most-recent meal)
 * glows and breathes, like the head of a comet. */
function TrailStar({ size, glow, isHead }: { size: number; glow: number; isHead: boolean }) {
  const breath = useSharedValue(0)
  useEffect(() => {
    if (!isHead) return
    breath.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [isHead, breath])

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
}

/* The new-meal preview star — it kindles as the form fills (name is
 * already typed, so progress tracks the two macro fields) and, once
 * the meal is valid, twinkles. A quiet promise of "sumar al cielo". */
function StarPreview({ progress, valid }: { progress: number; valid: boolean }) {
  const lit = useSharedValue(0)
  const tw = useSharedValue(0)

  useEffect(() => {
    lit.value = withTiming(progress, { duration: 420, easing: Easing.out(Easing.cubic) })
  }, [progress, lit])

  useEffect(() => {
    if (valid) {
      tw.value = withRepeat(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    } else {
      cancelAnimation(tw)
      tw.value = withTiming(0, { duration: 300 })
    }
    return () => cancelAnimation(tw)
  }, [valid, tw])

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
   *  tab's "Comidas de hoy" — edits the most recent meal of that name). */
  onOpenMeal: (id: string) => void
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

  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [calories, setCalories] = useState('')
  const [confirmed, setConfirmed] = useState<string | null>(null)

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

  // Trail magnitudes — each star's size maps the meal's log frequency
  // onto [MIN_STAR, MAX_STAR] relative to the rest of the estela.
  const n = history.length
  const freqs = history.map((h) => h.freq)
  const minFreq = freqs.length ? Math.min(...freqs) : 0
  const freqSpan = (freqs.length ? Math.max(...freqs) : 0) - minFreq
  const starCount = (foods ?? []).length

  const clear = () => {
    setName('')
    setProtein('')
    setCalories('')
  }

  const log = (meal: { name: string; protein_g: number; calories: number }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    createMeal.mutate({
      name: meal.name,
      protein_g: meal.protein_g,
      calories: meal.calories,
      consumed_at: new Date(),
      meal_type: currentMealType(),
    })
  }

  const handleLogRow = (item: FrequentMeal) => {
    if (confirmed) return
    log({ name: item.name, protein_g: item.protein_g, calories: item.calories })
    setConfirmed(item.name)
    setTimeout(() => setConfirmed((c) => (c === item.name ? null : c)), CONFIRM_MS)
  }

  const handleAddManual = () => {
    if (!manualValid) return
    log({ name: name.trim(), protein_g: proteinNum, calories: caloriesNum })
    clear()
  }

  return (
    <View>
      {/* ── Sumar comida — the search / create field. ── */}
      <SectionHeader label="Sumar comida" />

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
          <Text style={styles.newHint}>
            <Text style={styles.newHintName}>«{name.trim()}»</Text> aún no está en tu cielo. Dale su
            proteína y calorías.
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

          <PrimaryCta
            label="Sumar al cielo"
            variant="soft"
            onPress={handleAddManual}
            disabled={!manualValid}
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
        {history.map((item, i) => {
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
                        bottom: i === n - 1 ? '50%' : 0,
                      },
                    ]}
                  />
                ) : null}
                <TrailStar size={starSize} glow={starGlow} isHead={i === 0} />
              </View>

              <TouchableOpacity
                style={styles.body}
                activeOpacity={0.6}
                onPress={() => onOpenMeal(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${item.name}`}
                accessibilityHint="Abre la comida en el editor"
              >
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMacros}>
                  {Math.round(item.protein_g)} g · {item.calories} kcal
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addBtn, isConfirmed && styles.addBtnConfirmed]}
                activeOpacity={0.7}
                onPress={() => handleLogRow(item)}
                accessibilityRole="button"
                accessibilityLabel={`Registrar ${item.name}`}
              >
                <Text style={[styles.addIcon, isConfirmed && styles.addIconConfirmed]}>
                  {isConfirmed ? '✓' : '+'}
                </Text>
              </TouchableOpacity>
            </View>
          )
        })}

        {history.length === 0 ? (
          <Text style={styles.emptyHint}>
            {composing
              ? 'Nada con ese nombre — créala arriba.'
              : 'Tu estela está vacía. La comida que sumes aparecerá aquí.'}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  searchField: {
    height: 46,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontFamily: typography.displaySemi,
    fontSize: 15,
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
    fontSize: 11.5,
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
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: 15,
    paddingLeft: 2,
  },
  rowName: {
    fontFamily: typography.displaySemi,
    fontSize: 17,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  rowMacros: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.niebla,
  },
  // A quiet ghost circle — neutral ring, magenta glyph. It recedes so
  // the star trail keeps the spotlight; no fill, no glow.
  addBtn: {
    alignSelf: 'center',
    marginLeft: ADD_GAP,
    width: ADD_BTN,
    height: ADD_BTN,
    borderRadius: ADD_BTN / 2,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The confirm flash — the one moment the button goes solid.
  addBtnConfirmed: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
  },
  addIcon: {
    fontFamily: typography.uiBold,
    fontSize: 18,
    lineHeight: 20,
    color: colors.magenta,
  },
  addIconConfirmed: {
    color: '#FFFFFF',
  },
  emptyHint: {
    fontFamily: typography.ui,
    fontSize: 13,
    color: colors.niebla,
    paddingVertical: 10,
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
  newHint: {
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
    marginBottom: 14,
  },
  newHintName: {
    fontFamily: typography.uiSemi,
    color: colors.leche,
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
    fontSize: 15,
    color: colors.leche,
  },
  numberUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
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
