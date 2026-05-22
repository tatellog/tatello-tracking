import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { type CyclePhase } from '@/features/cycle/phase'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
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

/* Copy for the coach line under the protein sky. Keyed on meal count
 * — never on a percentage-to-target — so the line *witnesses* the
 * day rather than pushing toward a finish line. Food logging is
 * psychologically fragile: the voice here observes, never races.
 *
 * When the cycle phase is known, luteal and menstrual days swap in a
 * normalising line: appetite genuinely shifts across the cycle, and
 * the tab names that as biology, not as drift to correct.
 * The shared <CoachLine> renders it; this just picks the sentence. */
type SkyCopy = { before: string; emphasis: string; after: string }

function skyCopy(mealCount: number, phase: CyclePhase | null): SkyCopy {
  if (mealCount === 0) {
    return { before: 'Tu cielo de hoy está por ', emphasis: 'escribirse', after: '.' }
  }
  // Cycle-aware reassurance — only once the day has at least one meal
  // (a "your body asks for more" line makes no sense at zero).
  if (phase === 'lutea') {
    return {
      before: 'Fase lútea — tu cuerpo pide más estos días. Y ',
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

          {/* The sky always renders — logging a meal and seeing it
              never requires setting a number first. Targets are an
              optional reference, offered (not demanded) below. */}
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
  // Optional-target invite — a quiet line, not a wall. The tab is
  // fully usable without ever tapping it.
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
    fontSize: 13,
    lineHeight: 18,
    color: colors.niebla,
  },
  targetInviteChevron: {
    fontFamily: typography.uiMedium,
    fontSize: 20,
    color: colors.niebla,
  },
})
