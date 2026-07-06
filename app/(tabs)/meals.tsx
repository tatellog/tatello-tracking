import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import NorthStar from '@/assets/icons/north-star.svg'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { track } from '@/lib/analytics'
import {
  useMacroTargets,
  useMealsForDate,
  useNourishmentConsistency,
} from '@/features/macros/hooks'
import { NourishmentConsistency, NutritionMoon } from '@/features/macros/components'
import { useActiveLogDate } from '@/features/tabs/active-log-date'
import { useSetWater, useWaterToday } from '@/features/water/hooks'
import { MealComposer, MomentsToday, SkyBackground, TabHeader } from '@/features/tabs/components'
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

  const nourish = useNourishmentConsistency()
  // La fila de Agua de la card es ACCIÓN, no espejo: "vi mi tira floja →
  // sumé un vaso aquí mismo". Reusa el write hook optimista de Hoy.
  const todayWater = useWaterToday(today)
  const setWater = useSetWater(today)
  const addGlass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setWater.mutate((todayWater.data ?? 0) + 1)
  }

  // Sticky "Agregar entrada" → abre la cámara de captura (/capture-meal).
  const openCapture = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {})
    router.push('/capture-meal')
  }

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

          {/* §1 · Hero nutricional — proteína + luna + honestidad de avance. */}
          <NutritionMoon
            proteinValue={summary.protein}
            proteinTarget={targets?.protein_g}
            isLoading={mealsQuery.isLoading}
          />

          {/* Momentos del día — el lado práctico: qué falta capturar hoy.
              Refleja el día visto (mismas comidas que el hero). */}
          {mealsQuery.isLoading ? null : <MomentsToday meals={meals} viewingPast={viewingPast} />}

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

          {/* §2 CTA + §4 Registro + §3 Tus Aliados — todo en MealComposer,
              la acción más visible justo bajo el hero. */}
          <MealComposer
            onOpenMeal={(id, photoPath) => {
              track('food_card_opened', { meal_id: id })
              router.push({
                pathname: '/scan-meal',
                params: { editId: id, ...(photoPath ? { photoPath } : {}) },
              })
            }}
          />

          {/* Adherencia por-día ("Lo que alimenta tu transformación") — abajo,
              como contexto. ("Esta semana" se movió a Progreso: era análisis.) */}
          <NourishmentConsistency
            data={nourish.data}
            isLoading={nourish.isLoading}
            isError={nourish.isError}
            onAddReference={() => router.push('/onboarding/macro-targets?source=banner')}
            todayGlasses={todayWater.data ?? 0}
            onAddGlass={addGlass}
          />
        </ScrollView>
      </SafeAreaView>

      {/* Scrim bajo el sticky: el contenido se DESVANECE al pasar por
          debajo en vez de decapitarse contra la card (feedback dueña: el
          tercer aliado se veía cortado a mitad de scroll). */}
      <LinearGradient
        colors={['transparent', colors.bg]}
        locations={[0, 0.72]}
        style={styles.stickyScrim}
        pointerEvents="none"
      />
      {/* Sticky "Agregar entrada" — flota sobre la tab bar; la acción más
          visible del tab (reemplaza el CTA "Agregar comida" inline). Sin
          ícono de código de barras. */}
      <Pressable
        onPress={openCapture}
        style={[styles.sticky, { bottom: 6 }]}
        accessibilityRole="button"
        accessibilityLabel="Agregar entrada. Registra lo que alimenta tu universo."
      >
        <View style={styles.stickyStarWrap} pointerEvents="none">
          <View style={styles.stickyStarGlow} />
          <NorthStar width={30} height={30} color={colors.magenta} />
        </View>
        <View style={styles.stickyTextCol}>
          <Text style={styles.stickyTitle}>Agregar entrada</Text>
          <Text style={styles.stickySubtitle}>Registra lo que alimenta tu universo.</Text>
        </View>
      </Pressable>
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
  // ── Sticky "Agregar entrada" ──────────────────────────────────────
  stickyScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 132,
  },
  sticky: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.bgNav,
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.40)',
    // Glow magenta suave para que flote sobre el contenido.
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  stickyStarWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyStarGlow: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.magentaTint2,
  },
  stickyTextCol: {
    flex: 1,
    minWidth: 0,
  },
  stickyTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
  stickySubtitle: {
    marginTop: 2,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
