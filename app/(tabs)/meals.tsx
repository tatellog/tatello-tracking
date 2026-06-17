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
  useWeeklyMealStats,
} from '@/features/macros/hooks'
import { NourishmentConsistency, NutritionMoon, WeekSummary } from '@/features/macros/components'
import { useActiveLogDate } from '@/features/tabs/active-log-date'
import { MealComposer, SkyBackground, TabHeader } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

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
  // Coherencia con el "modo ver día" (P1): si Hoy está anclado a un día pasado,
  // el resumen de macros de Comidas refleja ESE día (el resto —consistencia,
  // semana, estela— son rangos/historia y no cambian).
  const activeLogDate = useActiveLogDate()
  const viewDate = activeLogDate ?? today
  const viewingPast = activeLogDate != null && activeLogDate !== today
  const mealsQuery = useMealsForDate(viewDate)
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
  const week = useWeeklyMealStats()

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

          {viewingPast ? (
            <Text style={styles.subtitle}>
              Macros del{' '}
              {`${Number(viewDate.slice(8, 10))} de ${MONTHS_ES[Number(viewDate.slice(5, 7)) - 1] ?? ''}`}
            </Text>
          ) : null}

          <NutritionMoon
            proteinValue={summary.protein}
            proteinTarget={targets?.protein_g}
            caloriesValue={summary.calories}
            isLoading={mealsQuery.isLoading}
          />

          <NourishmentConsistency
            data={nourish.data}
            isLoading={nourish.isLoading}
            isError={nourish.isError}
            onAddReference={() => router.push('/onboarding/macro-targets?source=banner')}
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
            onOpenMeal={(id, photoPath) => {
              track('food_card_opened', { meal_id: id })
              router.push({
                pathname: '/scan-meal',
                params: { editId: id, ...(photoPath ? { photoPath } : {}) },
              })
            }}
          />

          {/* Esta semana — resumen de actividad (comidas · días · proteína/día),
              debajo de Tu Estela. Volumen semanal, distinto de la adherencia
              por-día de "Lo que alimenta tu transformación". */}
          <WeekSummary stats={week.stats} isLoading={week.isLoading} isError={week.isError} />
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
