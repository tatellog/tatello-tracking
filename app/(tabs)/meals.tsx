import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useMacroTargets, useMealsForDate } from '@/features/macros/hooks'
import {
  CoachLine,
  DaySky,
  MealComposer,
  SkyBackground,
  TabHeader,
} from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/* Copy for the coach line under the protein sky — it follows the
 * day's protein arc so the screen has a voice, not just figures. The
 * shared <CoachLine> renders it; this just picks the sentence. */
type SkyCopy = { before: string; emphasis: string; after: string }

function skyCopy(pct: number, mealCount: number): SkyCopy {
  if (mealCount === 0) {
    return { before: 'Tu cielo está por ', emphasis: 'trazarse', after: '.' }
  }
  if (pct >= 1) {
    return { before: 'Lo cerraste. Cada estrella ', emphasis: 'cuenta', after: '.' }
  }
  if (pct >= 0.75) {
    return { before: 'Estás ', emphasis: 'cerca', after: ' de cerrar tu cielo.' }
  }
  if (pct >= 0.4) {
    return { before: 'Tu cielo va ', emphasis: 'tomando forma', after: '.' }
  }
  return { before: 'Cada comida ', emphasis: 'suma una estrella', after: '.' }
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
  const coachCopy = skyCopy(proteinPct, meals.length)

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TabHeader title="Tus comidas" titleEmphasis="Tus" />

          {targets ? (
            <>
              <DaySky
                meals={meals}
                proteinValue={summary.protein}
                proteinTarget={targets.protein_g}
                caloriesValue={summary.calories}
                caloriesTarget={targets.calories}
              />
              <CoachLine
                before={coachCopy.before}
                emphasis={coachCopy.emphasis}
                after={coachCopy.after}
              />
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
          <MealComposer
            onOpenMeal={(id) => router.push({ pathname: '/scan-meal', params: { editId: id } })}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  // Empty state — same card vocabulary as the rest of the app
  // (radius 16, hairline border) instead of the legacy radius-6 box.
  defineTargets: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
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
