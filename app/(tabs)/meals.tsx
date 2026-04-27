import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MealListItem } from '@/features/macros/components/MealListItem'
import { useDeleteMeal, useMealsForDate } from '@/features/macros/hooks'
import { todayInTimezone } from '@/lib/time'
import { colors, radius, shadows, spacing, typography } from '@/theme'

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + delta)
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

function humanDate(iso: string, today: string): string {
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function MealsScreen() {
  const router = useRouter()
  const today = useMemo(() => todayInTimezone(), [])
  const [selected, setSelected] = useState<string>(today)
  const mealsQuery = useMealsForDate(selected)
  const deleteMeal = useDeleteMeal()

  const meals = useMemo(() => mealsQuery.data ?? [], [mealsQuery.data])

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

  const canGoForward = selected !== today
  const previousDay = () => setSelected((d) => addDays(d, -1))
  const nextDay = () => {
    if (canGoForward) setSelected((d) => addDays(d, 1))
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={previousDay} style={styles.navBtn} accessibilityLabel="Día anterior">
            <Text style={styles.navGlyph}>‹</Text>
          </Pressable>
          <View style={styles.headerLabel}>
            <Text style={styles.meta}>COMIDAS</Text>
            <Text style={styles.headline}>{humanDate(selected, today)}</Text>
          </View>
          <Pressable
            onPress={nextDay}
            style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
            accessibilityLabel="Día siguiente"
            disabled={!canGoForward}
          >
            <Text style={[styles.navGlyph, !canGoForward && styles.navGlyphDisabled]}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.summary}>
          {Math.round(summary.protein)}g proteína · {summary.calories} cal · {meals.length}{' '}
          {meals.length === 1 ? 'comida' : 'comidas'}
        </Text>

        {meals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No loggeaste nada este día.</Text>
            {selected === today && (
              <Pressable onPress={() => router.push('/log-meal')} style={styles.emptyCta}>
                <Text style={styles.emptyCtaLabel}>Loggear comida</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {meals.map((meal, idx) => (
              <Animated.View
                key={meal.id}
                entering={FadeInDown.delay(idx * 60)
                  .springify()
                  .damping(18)}
              >
                <MealListItem
                  meal={meal}
                  onEdit={(id) => router.push(`/meal/${id}`)}
                  onDelete={(id) => deleteMeal.mutate(id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/log-meal')}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Loggear comida"
      >
        <Text style={styles.fabGlyph}>+</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl + 60,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pearlMuted,
    borderWidth: 0.5,
    borderColor: colors.borderDashed,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navGlyph: {
    fontSize: 20,
    color: colors.inkPrimary,
  },
  navGlyphDisabled: {
    color: colors.labelDim,
  },
  headerLabel: {
    flex: 1,
    alignItems: 'center',
  },
  meta: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.inkPrimary,
    textTransform: 'capitalize',
  },
  summary: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.labelMuted,
    textAlign: 'center',
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.labelMuted,
  },
  emptyCta: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.mauveDeep,
  },
  emptyCtaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.pearlBase,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.mauveDeep,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMauve,
  },
  fabGlyph: {
    fontSize: 28,
    color: colors.pearlBase,
    lineHeight: 28,
  },
})
