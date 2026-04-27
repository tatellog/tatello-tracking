import { LinearGradient } from 'expo-linear-gradient'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { MacroTargetsRow, TodayMacros } from '@/features/brief/api'
import { deriveMacroMessage } from '@/features/macros/logic'
import { colors, radius, shadows, spacing, typography } from '@/theme'

import { MacroRing } from './MacroRing'

type Props = {
  current: TodayMacros
  target: MacroTargetsRow
  mealCount: number
}

/*
 * Home card for today's macros. Mirrors the streak card's layout
 * language (creamShelf surface, card shadow, header row, two-column
 * visual, horizontal hairline, editorial closing line) so both
 * cards read as one system.
 *
 * The narrative line comes from deriveMacroMessage — pure, memoised
 * against (current, target, hour, mealCount) so mood scrolls and
 * meal toggles don't recompute the whole string every render.
 */
export function MacrosTodayCard({ current, target, mealCount }: Props) {
  const hour = useMemo(() => new Date().getHours(), [])
  const message = useMemo(
    () => deriveMacroMessage(current, target, hour, mealCount),
    [current, target, hour, mealCount],
  )

  const summaryLabel = `Hoy llevas ${Math.round(current.protein_g)} de ${target.protein_g} gramos de proteína y ${Math.round(current.calories)} de ${target.calories} calorías, con ${formatMealCount(mealCount)}.`

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={summaryLabel}
    >
      <View style={styles.header}>
        <Text style={styles.label}>HOY COMISTE</Text>
        <Text style={styles.subLabel}>{formatMealCount(mealCount)}</Text>
      </View>

      <View style={styles.rings}>
        <MacroRing
          current={current.protein_g}
          target={target.protein_g}
          label="proteína"
          unit="g"
          color="protein"
          delayMs={0}
        />
        <MacroRing
          current={current.calories}
          target={target.calories}
          label="calorías"
          unit="cal"
          color="calories"
          delayMs={150}
        />
      </View>

      <LinearGradient
        colors={['transparent', colors.borderSubtle, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.divider}
      />

      <Text style={styles.message}>{message}</Text>
    </View>
  )
}

function formatMealCount(count: number): string {
  if (count === 0) return 'sin comidas'
  if (count === 1) return '1 comida'
  return `${count} comidas`
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  subLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelDim,
  },
  rings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  message: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.inkPrimary,
    textAlign: 'center',
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
})
