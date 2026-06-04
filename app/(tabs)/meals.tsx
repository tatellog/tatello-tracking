import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { type CyclePhase } from '@/features/cycle/phase'
import { track } from '@/lib/analytics'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { useMacroTargets, useMealsForDate, useWeeklyMealStats } from '@/features/macros/hooks'
import { WeekSummary } from '@/features/macros/components/WeekSummary'
import {
  CoachLine,
  DaySky,
  MealComposer,
  SkyBackground,
  TabHeader,
} from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

type SkyCopy = { before: string; emphasis: string; after: string }

function skyCopy(mealCount: number, phase: CyclePhase | null): SkyCopy {
  if (mealCount === 0) {
    return { before: 'Tu cielo de hoy está por ', emphasis: 'escribirse', after: '.' }
  }
  if (phase === 'lutea') {
    return {
      before: 'La semana antes de tu período tu cuerpo pide más. Y ',
      emphasis: 'está bien',
      after: '.',
    }
  }
  if (phase === 'menstrual') {
    return {
      before: 'Estás menstruando. Comer con ',
      emphasis: 'suavidad',
      after: ' hoy es cuidarte.',
    }
  }
  if (mealCount === 1) {
    return { before: 'Una estrella. El día empieza a ', emphasis: 'nutrirse', after: '.' }
  }
  if (mealCount <= 3) {
    return { before: 'Tu cielo se va ', emphasis: 'poblando', after: '.' }
  }
  return { before: 'Un cielo lleno. Hoy te ', emphasis: 'nutriste', after: '.' }
}

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

  const cycle = useCyclePhase()
  const coachCopy = skyCopy(meals.length, cycle?.phase ?? null)
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
          <TabHeader title="Tus comidas" titleEmphasis="Tus" />

          <DaySky
            meals={meals}
            proteinValue={summary.protein}
            proteinTarget={targets?.protein_g}
            caloriesValue={summary.calories}
          />
          <CoachLine
            before={coachCopy.before}
            emphasis={coachCopy.emphasis}
            after={coachCopy.after}
          />

          {targets ? null : (
            <Pressable
              onPress={() => router.push('/onboarding/macro-targets?source=banner')}
              style={styles.targetInvite}
              accessibilityRole="button"
              accessibilityLabel="Añadir una referencia de proteína"
            >
              <Text style={styles.targetInviteText}>
                Las metas son opcionales. Añade una referencia de proteína cuando quieras.
              </Text>
              <Text style={styles.targetInviteChevron}>›</Text>
            </Pressable>
          )}

          {/* Esta semana — a calm, collapsible weekly read (protein +
              logging consistency), in coach voice. Lives here, not in a
              stats tab and not in Progreso (which is the body). */}
          <WeekSummary stats={week.stats} isLoading={week.isLoading} isError={week.isError} />

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
