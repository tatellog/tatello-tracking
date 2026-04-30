import { LinearGradient } from 'expo-linear-gradient'
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  name: string
  protein_g: number
  calories: number
  /** "Cambiar plato" → swap suggestion / clear the form. */
  onChangePlate: () => void
  /** "Editar números" → switch to manual editing on the same plate. */
  onEditNumbers?: () => void
}

/*
 * Hero card shown after the user picks a suggestion (or supplies
 * full manual data). Mauve border + soft pearl→tinted gradient draw
 * the eye to the chosen plate; numbers in Inter Tight 32 Light read
 * as "decided" without crossing into shouting.
 *
 * "Cambiar o editar →" opens a small action sheet so the user can
 * either swap the entire plate or tweak the macros without leaving
 * the screen. Web falls back to window.confirm — it's good enough
 * for dev / web testing without dragging in a third-party sheet.
 */
export function FilledMealCard({ name, protein_g, calories, onChangePlate, onEditNumbers }: Props) {
  const handleChangeOrEdit = () => {
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        typeof window.confirm === 'function' &&
        window.confirm('¿Elegir otra sugerencia? (Cancelar deja este plato como está.)')
      if (ok) onChangePlate()
      return
    }
    Alert.alert(
      'Cambiar o editar',
      undefined,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Elegir otra sugerencia', onPress: onChangePlate },
        ...(onEditNumbers ? [{ text: 'Editar números', onPress: onEditNumbers }] : []),
      ],
      { cancelable: true },
    )
  }

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.pearlElevated, '#FCF7F9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Text style={styles.tag}>TU PLATO</Text>
      <Text style={styles.name}>{name}</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <View style={styles.numRow}>
            <Text style={styles.num}>{protein_g}</Text>
            <Text style={styles.unit}>g</Text>
          </View>
          <Text style={styles.statLabel}>Proteína</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <View style={styles.numRow}>
            <Text style={styles.num}>{calories}</Text>
            <Text style={styles.unit}>cal</Text>
          </View>
          <Text style={styles.statLabel}>Calorías</Text>
        </View>
      </View>

      <Pressable onPress={handleChangeOrEdit} style={styles.linkWrap}>
        <Text style={styles.link}>CAMBIAR O EDITAR →</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.mauveDeep,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.mauveShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  tag: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 6,
  },
  name: {
    fontFamily: typography.displayMedium,
    fontSize: 20,
    letterSpacing: -0.5,
    color: colors.inkPrimary,
    lineHeight: 24,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  num: {
    fontFamily: typography.display,
    fontSize: 32,
    letterSpacing: -1.2,
    color: colors.inkPrimary,
    lineHeight: 32,
  },
  unit: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.labelMuted,
  },
  statLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 50,
    backgroundColor: colors.borderSubtle,
  },
  linkWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    borderStyle: 'dashed',
  },
  link: {
    fontFamily: typography.uiMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.labelMuted,
    textAlign: 'center',
  },
})
