import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  name: string
  onNameChange: (v: string) => void
  protein: string
  onProteinChange: (v: string) => void
  calories: string
  onCaloriesChange: (v: string) => void
  /** "desayunaste" / "comiste" / "cenaste" / etc. */
  mealVerb: string
  /**
   * State 4 — the user is actively typing. Switches each field's
   * surface from pearl + hairline to tinted #FCF7F9 + 1 px mauve
   * border so it reads as "this is what you're filling in".
   */
  active?: boolean
}

/*
 * Plan B form for when the suggestor doesn't fit. Three plain inputs
 * laid out as: a full-width name field on top, a 50/50 row of
 * protein + calories below.
 *
 * Visually muted compared to the suggestion list — these are the
 * fallback path. The header eyebrow on top and the divider above
 * already signal "or, write your own".
 */
export function ManualInputs({
  name,
  onNameChange,
  protein,
  onProteinChange,
  calories,
  onCaloriesChange,
  mealVerb,
  active = false,
}: Props) {
  const handleProtein = (v: string) => onProteinChange(v.replace(/[^0-9.]/g, ''))
  const handleCalories = (v: string) => onCaloriesChange(v.replace(/[^0-9]/g, ''))

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{`¿QUÉ ${mealVerb.toUpperCase()}?`}</Text>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          placeholder="Pollo con arroz..."
          placeholderTextColor={colors.labelDim}
          style={[styles.inputText, active && styles.inputActive]}
          maxLength={80}
          autoCapitalize="sentences"
          returnKeyType="next"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.numField, active && styles.numFieldActive]}>
          <Text style={styles.numLabel}>PROTEÍNA</Text>
          <View style={styles.numRow}>
            <TextInput
              value={protein}
              onChangeText={handleProtein}
              placeholder="35"
              placeholderTextColor={colors.labelDim}
              keyboardType="decimal-pad"
              maxLength={5}
              style={[styles.numInput, protein.length > 0 && styles.numInputFilled]}
            />
            <Text style={styles.numUnit}>g</Text>
          </View>
        </View>
        <View style={[styles.numField, active && styles.numFieldActive]}>
          <Text style={styles.numLabel}>CALORÍAS</Text>
          <View style={styles.numRow}>
            <TextInput
              value={calories}
              onChangeText={handleCalories}
              placeholder="600"
              placeholderTextColor={colors.labelDim}
              keyboardType="number-pad"
              maxLength={4}
              style={[styles.numInput, calories.length > 0 && styles.numInputFilled]}
            />
            <Text style={styles.numUnit}>cal</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.labelMuted,
  },
  inputText: {
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontFamily: typography.ui,
    fontSize: 14,
    color: colors.inkPrimary,
  },
  inputActive: {
    borderWidth: 1,
    borderColor: colors.mauveDeep,
    backgroundColor: '#FCF7F9',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  numField: {
    flex: 1,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
  },
  numFieldActive: {
    borderWidth: 1,
    borderColor: colors.mauveDeep,
    backgroundColor: '#FCF7F9',
  },
  numLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.labelMuted,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  numInput: {
    flex: 1,
    fontFamily: typography.display,
    fontSize: 22,
    letterSpacing: -0.6,
    color: colors.labelDim,
    padding: 0,
    minWidth: 0,
  },
  numInputFilled: {
    color: colors.inkPrimary,
  },
  numUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.labelMuted,
  },
})
