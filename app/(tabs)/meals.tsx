import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { track } from '@/lib/analytics'
import { useMacroTargets, useMealsForDate } from '@/features/macros/hooks'
import { NutritionMoon } from '@/features/macros/components'
import { useActiveLogDate } from '@/features/tabs/active-log-date'
import {
  DayMealList,
  MealComposer,
  MomentsToday,
  SkyBackground,
  TabHeader,
} from '@/features/tabs/components'
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
  const insets = useSafeAreaInsets()
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

  // (Dirección de arte sep 2026: Comidas responde "¿qué comí hoy?". Se
  // retiraron la card de 7 días proteína+agua, la fila de agua (vive en el
  // registro rápido) y la barra fija "Agregar entrada", que duplicaba el
  // botón global Registrar.)

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
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

          {/* Error de carga: se DICE, nunca se pinta "0 g" (en una app de peso,
              "no comiste nada" sería mentira). */}
          {mealsQuery.isError && !mealsQuery.data ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>No pudimos traer tus comidas.</Text>
              <Pressable
                onPress={() => mealsQuery.refetch()}
                style={styles.retry}
                accessibilityRole="button"
                accessibilityLabel="Reintentar"
              >
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* §1 · Hero — proteína de hoy + luna (el medidor). */}
              <NutritionMoon
                proteinValue={summary.protein}
                proteinTarget={targets?.protein_g}
                isLoading={mealsQuery.isLoading}
              />

              {/* Los astros AGREGAN (tocar = registrar en ese momento) y la
                  lista del día se lee y se edita (tocar = abrir el editor, donde
                  también se borra). Reflejan el día visto. */}
              {mealsQuery.isLoading ? null : (
                <>
                  <MomentsToday meals={meals} viewingPast={viewingPast} />
                  <DayMealList
                    meals={meals}
                    viewingPast={viewingPast}
                    onOpenMeal={(id) => {
                      track('food_card_opened', { meal_id: id })
                      router.push({ pathname: '/scan-meal', params: { editId: id } })
                    }}
                  />
                </>
              )}
            </>
          )}

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

          {/* Registro abierto + "Tus comidas frecuentes". */}
          <MealComposer />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  errorBlock: {
    marginTop: 24,
    gap: 12,
    alignItems: 'flex-start',
  },
  errorText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  retry: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  retryText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.3,
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
  // ── Sticky "Agregar entrada" ──────────────────────────────────────
})
