import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { track } from '@/lib/analytics'
import {
  useMacroTargets,
  useMealsForDate,
  useNourishmentConsistency,
} from '@/features/macros/hooks'
import { NourishmentConsistency, NutritionMoon } from '@/features/macros/components'
import { MealComposer, SkyBackground, TabHeader } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

export default function MealsScreen() {
  return (
    <ErrorBoundary screen="comidas">
      <MealsBody />
    </ErrorBoundary>
  )
}

function MealsBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'comidas' })
    }, []),
  )
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

  const nourish = useNourishmentConsistency()

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
          <TabHeader title="Comidas" />
          <Text style={styles.subtitle}>Alimenta tu transformación.</Text>

          <NutritionMoon
            proteinValue={summary.protein}
            proteinTarget={targets?.protein_g}
            caloriesValue={summary.calories}
          />

          <NourishmentConsistency
            data={nourish.data}
            isLoading={nourish.isLoading}
            isError={nourish.isError}
          />

          {targets ? null : (
            <Pressable
              onPress={() => router.push('/onboarding/macro-targets?source=banner')}
              style={styles.targetInvite}
              accessibilityRole="button"
              accessibilityLabel="Añadir una referencia de proteína"
            >
              <Text style={styles.targetInviteText}>
                La referencia de proteína es opcional. Añádela cuando quieras.
              </Text>
              <Text style={styles.targetInviteChevron}>›</Text>
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
  // Sits tucked under the "Comidas" title (TabHeader owns its own bottom
  // margin, so we pull the subtitle up to read as one header block).
  subtitle: {
    marginTop: -10,
    marginBottom: 4,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  targetInvite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingVertical: 4,
  },
  targetInviteText: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  targetInviteChevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.niebla,
  },
})
