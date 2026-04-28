import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  /** Cuántas medidas tiene el usuario (0 → primer registro, 1 → falta una). */
  measurementCount: 0 | 1
  onAdd: () => void
}

/*
 * Empty states diferenciados:
 *   - 0 medidas → CTA mauve gradient grande "Agregá tu primer peso".
 *   - 1 medida  → texto suave + CTA en pearl elevated. La medida única
 *                 ya se muestra como hero stat arriba; este componente
 *                 sólo invita a la segunda.
 */
export function EmptyState({ measurementCount, onAdd }: Props) {
  if (measurementCount === 0) {
    return (
      <View style={styles.zeroRoot}>
        <Text style={styles.zeroTitle}>Sin medidas todavía</Text>
        <Text style={styles.zeroBody}>
          Empezá registrando tu peso de hoy. Volvé en una semana y vas a empezar a ver la línea.
        </Text>
        <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Agregar peso">
          <View style={shadows.ctaMauve}>
            <LinearGradient
              colors={[colors.mauveLight, colors.mauveDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaPrimary}
            >
              <Text style={styles.ctaPrimaryLabel}>Agregar peso</Text>
            </LinearGradient>
          </View>
        </Pressable>
      </View>
    )
  }

  // Caso 1 medida: ya hay hero stat arriba, este es un CTA secundario.
  return (
    <View style={styles.oneRoot}>
      <Text style={styles.oneCopy}>Agregá una segunda medida para ver tu trayectoria.</Text>
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel="Agregar otra medida"
        style={styles.ctaSecondary}
      >
        <Text style={styles.ctaSecondaryLabel}>Agregar otra medida</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  zeroRoot: {
    backgroundColor: colors.pearlElevated,
    borderColor: colors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  zeroTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.fontWeight.semi,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  zeroBody: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    fontWeight: typography.fontWeight.regular,
    color: colors.labelMuted,
    textAlign: 'center',
    lineHeight: typography.sizes.body * typography.lineHeight.body,
  },
  ctaPrimary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
  },
  ctaPrimaryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.bodyLoose,
    color: colors.pearlElevated,
  },

  oneRoot: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  oneCopy: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    fontWeight: typography.fontWeight.regular,
    color: colors.labelMuted,
    textAlign: 'center',
  },
  ctaSecondary: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  ctaSecondaryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    fontWeight: typography.fontWeight.medium,
    color: colors.inkPrimary,
  },
})
