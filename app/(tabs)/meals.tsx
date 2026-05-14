import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useMacroTargets, useMealsForDate } from '@/features/macros/hooks'
import { MacroLine, PrimaryCta, SectionHeader, TabHeader } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, shadows, typography } from '@/theme'

const SPANISH_WEEKDAY_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const

const MEAL_EMOJI: Record<string, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍽',
  snack: '💪',
}

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  dinner: 'Cena',
  snack: 'Snack',
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

  const pillLabel = useMemo(() => {
    const now = new Date()
    const weekday = SPANISH_WEEKDAY_SHORT[now.getDay()] ?? 'HOY'
    return `HOY · ${weekday} ${now.getDate()}`
  }, [])

  const proteinPct = targets ? summary.protein / targets.protein_g : 0
  const caloriesPct = targets ? summary.calories / targets.calories : 0

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TabHeader
            title="Tu comida"
            titleEmphasis="Tu"
            pillLabel={pillLabel}
            pillEmphasis="HOY"
          />

          {targets ? (
            <>
              <MacroLine
                label="Proteína"
                value={Math.round(summary.protein).toString()}
                unit="g"
                pct={proteinPct}
                footerLeft={`${Math.round(proteinPct * 100)}% de tu meta`}
                footerLeftEmphasis={`${Math.round(proteinPct * 100)}%`}
                footerRight={`faltan ${Math.max(0, Math.round(targets.protein_g - summary.protein))}g`}
                footerRightEmphasis={`${Math.max(0, Math.round(targets.protein_g - summary.protein))}g`}
                delay={120}
              />
              <MacroLine
                label="Calorías"
                value={Math.round(summary.calories).toString()}
                unit="kcal"
                pct={caloriesPct}
                footerLeft={`${Math.round(caloriesPct * 100)}% de tu meta`}
                footerLeftEmphasis={`${Math.round(caloriesPct * 100)}%`}
                footerRight={`faltan ${Math.max(0, targets.calories - summary.calories)}`}
                footerRightEmphasis={`${Math.max(0, targets.calories - summary.calories)}`}
                delay={260}
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
                Para ver tu proteína y calorías como porcentaje, primero pon tus números base.
              </Text>
            </Pressable>
          )}

          <SectionHeader
            label="Lo de hoy"
            meta={{ value: String(meals.length), label: meals.length === 1 ? 'comida' : 'comidas' }}
          />

          {meals.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No loggeaste nada todavía.</Text>
              <Text style={styles.emptyHint}>Empieza por el desayuno.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {meals.map((m, idx) => {
                const mealType =
                  (m.meal_type as keyof typeof MEAL_LABEL | null | undefined) ?? 'snack'
                const time = (() => {
                  const d = new Date(m.consumed_at)
                  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                })()
                return (
                  <Animated.View
                    key={m.id}
                    entering={FadeInDown.delay(idx * 60)
                      .springify()
                      .damping(18)}
                  >
                    <Pressable
                      onPress={() => router.push(`/meal/${m.id}`)}
                      style={styles.meal}
                      accessibilityRole="button"
                      accessibilityLabel={m.name}
                    >
                      <View style={styles.mealImg}>
                        <Text style={styles.mealEmoji}>{MEAL_EMOJI[mealType] ?? '🍽'}</Text>
                      </View>
                      <View style={styles.mealBody}>
                        <Text style={styles.mealName} numberOfLines={2}>
                          {m.name}
                        </Text>
                        <Text style={styles.mealMeta}>
                          {(MEAL_LABEL[mealType] ?? 'Comida').toUpperCase()} · {time}
                        </Text>
                      </View>
                      <View style={styles.mealNums}>
                        <Text style={styles.mealProtein}>
                          {Math.round(Number(m.protein_g))}
                          <Text style={styles.mealProteinUnit}>g</Text>
                        </Text>
                        <Text style={styles.mealCal}>{m.calories} kcal</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                )
              })}
            </View>
          )}

          <PrimaryCta
            label="Sumar comida →"
            onPress={() => router.push('/log-meal')}
            marginTop={24}
            marginBottom={16}
          />
        </ScrollView>
      </SafeAreaView>

      <Pressable
        onPress={() => router.push('/log-meal')}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Loggear comida"
      >
        <Text style={styles.fabGlyph}>+</Text>
      </Pressable>
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
    paddingBottom: 100,
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
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyTitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
    marginBottom: 4,
  },
  emptyHint: {
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.niebla,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  list: {
    gap: 8,
  },
  meal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 6,
    padding: 10,
  },
  mealImg: {
    width: 64,
    height: 64,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,236,222,0.03)',
  },
  mealEmoji: {
    fontSize: 24,
  },
  mealBody: {
    flex: 1,
    minWidth: 0,
  },
  mealName: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.leche,
    lineHeight: 18,
    marginBottom: 4,
  },
  mealMeta: {
    fontFamily: typography.uiSemi,
    fontSize: 9.5,
    color: colors.niebla,
    letterSpacing: 1.8,
  },
  mealNums: {
    alignItems: 'flex-end',
  },
  mealProtein: {
    fontFamily: typography.displayHeavy,
    fontSize: 22,
    color: colors.leche,
    letterSpacing: -0.7,
    lineHeight: 22,
  },
  mealProteinUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.magenta,
  },
  mealCal: {
    marginTop: 3,
    fontFamily: typography.uiSemi,
    fontSize: 10,
    color: colors.niebla,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMagenta,
  },
  fabGlyph: {
    fontFamily: typography.uiMedium,
    fontSize: 28,
    color: '#FFFFFF',
    lineHeight: 28,
  },
})
