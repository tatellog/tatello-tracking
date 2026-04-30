import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { MealSuggestion } from '@/features/macros/hooks/useMealSuggestions'
import { colors, typography } from '@/theme'

type Props = {
  suggestions: MealSuggestion[]
  onSelect: (suggestion: MealSuggestion) => void
}

/*
 * Up to 3 vertically-stacked suggestion rows for the current meal
 * slot. The first row is the "Lo de ayer" anchor — bordered in mauve
 * with a soft pearl→tinted gradient so the eye lands there first.
 * The other rows fall back to muted "Reciente" treatment.
 *
 * Returns null when the list is empty so the parent's "o escribe"
 * divider isn't orphaned with nothing to divide from.
 */
export function SuggestionsList({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>PROBABLE</Text>
        <Text style={styles.labelSoft}>
          {suggestions.length} {suggestions.length === 1 ? 'opción' : 'opciones'}
        </Text>
      </View>

      <View style={styles.list}>
        {suggestions.map((s, idx) => {
          const isHero = idx === 0
          return (
            <Pressable
              key={s.id}
              onPress={() => onSelect(s)}
              style={({ pressed }) => [
                styles.itemBase,
                isHero ? styles.itemHero : styles.itemMuted,
                pressed && styles.itemPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${s.protein_g} gramos de proteína, ${s.calories} calorías`}
            >
              {isHero ? (
                <LinearGradient
                  colors={[colors.pearlElevated, '#FCF7F9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              ) : null}
              <View style={styles.itemBody}>
                <Text style={[styles.tag, isHero ? styles.tagHero : styles.tagMuted]}>
                  {s.source === 'yesterday' ? 'Lo de ayer' : 'Reciente'}
                </Text>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.stats}>
                  <Text style={styles.statsBold}>{s.protein_g}g</Text> proteína ·{' '}
                  <Text style={styles.statsBold}>{s.calories}</Text> cal
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginBottom: 22,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
  },
  labelSoft: {
    fontFamily: typography.uiMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.labelDim,
  },
  list: {
    gap: 8,
  },
  itemBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.pearlElevated,
    overflow: 'hidden',
    position: 'relative',
  },
  itemHero: {
    borderWidth: 1,
    borderColor: colors.mauveDeep,
    shadowColor: colors.mauveShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  itemMuted: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  itemPressed: {
    opacity: 0.85,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  tag: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  tagHero: {
    color: colors.mauveDeep,
  },
  tagMuted: {
    color: colors.labelDim,
  },
  name: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.inkPrimary,
    lineHeight: 18,
  },
  stats: {
    fontFamily: typography.ui,
    fontSize: 11,
    color: colors.labelMuted,
  },
  statsBold: {
    fontFamily: typography.displayMedium,
    fontSize: 11,
    letterSpacing: -0.2,
    color: colors.inkPrimary,
  },
  arrow: {
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.labelDim,
    lineHeight: 22,
  },
})
