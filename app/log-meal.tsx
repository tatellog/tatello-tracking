import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import { useBriefContext } from '@/features/brief/hooks'
import {
  DividerWithText,
  FeedbackCard,
  FilledMealCard,
  ManualInputs,
  SuggestionsList,
} from '@/features/macros/components'
import { useCreateMeal, useMacroTargets } from '@/features/macros/hooks'
import { useMealSuggestions, type MealSuggestion } from '@/features/macros/hooks/useMealSuggestions'
import { formatMealHeaderTime, inferMealType } from '@/features/macros/utils/mealType'
import { colors, radius, shadows, spacing, typography } from '@/theme'

/*
 * Pareto-redesigned log-meal screen.
 *
 * Above the fold:
 *   ── EYEBROW: "Cena · 7:35pm" (meal slot inferred from clock)
 *   ── HEADLINE: "¿Qué cenaste?" (verb conjugates with the slot)
 *
 * Two states:
 *   A. Empty — show 3 suggestions (top one is "Lo de ayer", others
 *      "Reciente"), then a divider, then plain inputs as plan B.
 *   B. Filled — single hero card with the chosen plate + a
 *      contextual feedback line ("Después de esta cena: 95g · te
 *      faltan 35g.").
 *
 * Submit button is mauve gradient when there's a valid plate
 * (suggestion OR all three manual fields), pearl/disabled when
 * not. Copy adapts: "Guardar cena" / "Guardar desayuno" / etc.
 */

export default function LogMealScreen() {
  const router = useRouter()

  // The clock is captured ONCE on mount so the meal slot doesn't
  // shift if the user lingers on the screen across an hour boundary
  // (e.g. typing through 4:00 pm).
  const now = useRef(new Date()).current
  const meal = useMemo(() => inferMealType(now), [now])

  const [selected, setSelected] = useState<MealSuggestion | null>(null)
  const [manualName, setManualName] = useState('')
  const [manualProtein, setManualProtein] = useState('')
  const [manualCalories, setManualCalories] = useState('')

  const { data: suggestions = [] } = useMealSuggestions(meal.type)
  const { data: brief } = useBriefContext()
  const { data: targets } = useMacroTargets()
  const createMeal = useCreateMeal()

  const manualValid = useMemo(() => {
    const proteinNum = parseFloat(manualProtein)
    const caloriesNum = parseInt(manualCalories, 10)
    return (
      manualName.trim().length >= 2 &&
      Number.isFinite(proteinNum) &&
      proteinNum >= 0 &&
      Number.isFinite(caloriesNum) &&
      caloriesNum > 0
    )
  }, [manualName, manualProtein, manualCalories])

  const currentMeal = useMemo(() => {
    if (selected) {
      return {
        name: selected.name,
        protein_g: selected.protein_g,
        calories: selected.calories,
      }
    }
    return {
      name: manualName.trim(),
      protein_g: parseFloat(manualProtein) || 0,
      calories: parseInt(manualCalories, 10) || 0,
    }
  }, [selected, manualName, manualProtein, manualCalories])

  const hasFilledMeal = selected !== null || manualValid

  const projected = useMemo(() => {
    const baseProtein = brief?.today_macros.protein_g ?? 0
    const baseCal = brief?.today_macros.calories ?? 0
    return {
      protein: baseProtein + currentMeal.protein_g,
      calories: baseCal + currentMeal.calories,
    }
  }, [brief, currentMeal])

  const handleSelectSuggestion = (s: MealSuggestion) => {
    Haptics.selectionAsync().catch(() => {})
    setSelected(s)
    setManualName('')
    setManualProtein('')
    setManualCalories('')
  }

  const handleClearPlate = () => {
    setSelected(null)
  }

  const handleEditNumbers = () => {
    if (!selected) return
    setManualName(selected.name)
    setManualProtein(String(selected.protein_g))
    setManualCalories(String(selected.calories))
    setSelected(null)
  }

  const handleSave = () => {
    if (!hasFilledMeal) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    createMeal.mutate(
      {
        name: currentMeal.name,
        protein_g: currentMeal.protein_g,
        calories: currentMeal.calories,
        consumed_at: now,
        meal_type: meal.type,
      },
      {
        onSuccess: () => {
          Toast.show({ type: 'success', text1: 'Comida guardada' })
          router.back()
        },
        onError: () => {
          Toast.show({
            type: 'error',
            text1: 'No pudimos guardar',
            text2: 'Revisá tu conexión e intentá de nuevo.',
          })
        },
      },
    )
  }

  const isPending = createMeal.isPending

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              {meal.label.toUpperCase()} · {formatMealHeaderTime(now)}
            </Text>
            <Text style={styles.title}>
              ¿Qué <Text style={styles.titleEmphasis}>{meal.verb}</Text>?
            </Text>
          </View>

          {selected ? (
            <>
              <FilledMealCard
                name={currentMeal.name}
                protein_g={currentMeal.protein_g}
                calories={currentMeal.calories}
                onChangePlate={handleClearPlate}
                onEditNumbers={handleEditNumbers}
              />
              {targets ? (
                <FeedbackCard
                  projected={projected}
                  targets={{ protein_g: targets.protein_g, calories: targets.calories }}
                  mealLabel={meal.label.toLowerCase()}
                />
              ) : null}
            </>
          ) : (
            <>
              <SuggestionsList suggestions={suggestions} onSelect={handleSelectSuggestion} />
              {suggestions.length > 0 ? <DividerWithText text="o escribe" /> : null}
              <ManualInputs
                name={manualName}
                onNameChange={setManualName}
                protein={manualProtein}
                onProteinChange={setManualProtein}
                calories={manualCalories}
                onCaloriesChange={setManualCalories}
                mealVerb={meal.verb}
              />
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!hasFilledMeal || isPending}
            style={({ pressed }) => [
              styles.cta,
              !hasFilledMeal && styles.ctaDisabled,
              pressed && hasFilledMeal && !isPending && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={meal.saveLabel}
            accessibilityState={{ disabled: !hasFilledMeal, busy: isPending }}
          >
            {hasFilledMeal && !isPending ? (
              <LinearGradient
                colors={[colors.mauveLight, colors.mauveDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {isPending ? (
              <View style={styles.ctaRow}>
                <ActivityIndicator color={colors.pearlBase} size="small" />
                <Text style={styles.ctaLabel}>Guardando…</Text>
              </View>
            ) : (
              <Text style={[styles.ctaLabel, !hasFilledMeal && styles.ctaLabelDisabled]}>
                {meal.saveLabel}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: 22,
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 6,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 32,
    letterSpacing: -1.4,
    color: colors.inkPrimary,
    lineHeight: 34,
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.pearlBase,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  cta: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMauve,
  },
  ctaDisabled: {
    backgroundColor: colors.borderSubtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 14.5,
    letterSpacing: 0.3,
    color: colors.pearlBase,
  },
  ctaLabelDisabled: {
    color: colors.labelDim,
  },
  cancel: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.labelDim,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
})
