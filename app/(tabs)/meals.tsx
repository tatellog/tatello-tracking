import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useMacroTargets, useMealsForDate } from '@/features/macros/hooks'
import { MacroLine, MealComposer, TabHeader } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/* Editorial line under the macro summary — it follows the protein arc
 * of the day so the screen has a voice, not just figures. */
function skyCopy(pct: number, mealCount: number): string {
  if (mealCount === 0) return 'Tu cielo está por trazarse.'
  if (pct >= 1) return 'Cerraste tu cielo. Cada estrella cuenta.'
  if (pct >= 0.75) return 'Una estrella más y lo completas.'
  if (pct >= 0.4) return 'Tu cielo va tomando forma.'
  return 'Cada comida suma una estrella.'
}

export default function MealsScreen() {
  const router = useRouter()
  const today = useMemo(() => todayInTimezone(), [])
  const mealsQuery = useMealsForDate(today)
  const targetsQuery = useMacroTargets()

  const meals = useMemo(() => mealsQuery.data ?? [], [mealsQuery.data])
  const targets = targetsQuery.data

  const summary = useMemo(
    () =>
      meals.reduce(
        (acc, m) => ({
          protein: acc.protein + Number(m.protein_g),
          calories: acc.calories + m.calories,
        }),
        { protein: 0, calories: 0 },
      ),
    [meals],
  )

  const proteinPct = targets ? summary.protein / targets.protein_g : 0
  const caloriesPct = targets ? summary.calories / targets.calories : 0
  const proteinLeft = targets ? Math.max(0, Math.round(targets.protein_g - summary.protein)) : 0
  const caloriesLeft = targets ? Math.max(0, Math.round(targets.calories - summary.calories)) : 0

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TabHeader title="Tus comidas" titleEmphasis="Tus" />

          {targets ? (
            <>
              {/* Compact macro summary — context while you log, not a
                  panel that competes with the meal list below. */}
              <View style={styles.macros}>
                <MacroLine
                  label="Proteína"
                  value={String(Math.round(summary.protein))}
                  unit={` / ${targets.protein_g} g`}
                  pct={proteinPct}
                  footerLeft={`${Math.round(proteinPct * 100)} %`}
                  footerRight={proteinLeft > 0 ? `faltan ${proteinLeft} g` : 'meta cumplida'}
                  footerRightEmphasis={proteinLeft > 0 ? `${proteinLeft} g` : undefined}
                />
                <MacroLine
                  label="Calorías"
                  value={String(Math.round(summary.calories))}
                  unit={` / ${targets.calories} kcal`}
                  pct={caloriesPct}
                  footerLeft={`${Math.round(caloriesPct * 100)} %`}
                  footerRight={
                    caloriesLeft > 0 ? `restan ${caloriesLeft} kcal` : 'presupuesto lleno'
                  }
                  footerRightEmphasis={caloriesLeft > 0 ? `${caloriesLeft} kcal` : undefined}
                  delay={350}
                />
              </View>
              <Text style={styles.coachLine}>{skyCopy(proteinPct, meals.length)}</Text>
            </>
          ) : (
            <Pressable
              onPress={() => router.push('/onboarding/macro-targets?source=banner')}
              style={styles.defineTargets}
              accessibilityRole="button"
              accessibilityLabel="Definir metas"
            >
              <Text style={styles.defineTargetsLabel}>Define tus metas</Text>
              <Text style={styles.defineTargetsHint}>
                Para ver tu cielo de proteína y tus calorías, primero pon tus números base.
              </Text>
            </Pressable>
          )}

          {/* Sumar comida (search / create) + Tu estela (the food
              history) — two sections, both owned by MealComposer. */}
          <MealComposer onOpenMeal={(id) => router.push(`/meal/${id}`)} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  macros: {
    marginTop: 8,
  },
  coachLine: {
    fontFamily: typography.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.bone,
    marginBottom: 4,
  },
  defineTargets: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 6,
    padding: 14,
    marginBottom: 12,
  },
  defineTargetsLabel: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  defineTargetsHint: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.bone,
    lineHeight: 17,
  },
})
