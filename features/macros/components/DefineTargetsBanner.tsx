import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, shadows, spacing, typography } from '@/theme'

/*
 * Shown in the Home's macros slot when the user hasn't set goals
 * yet. Tap opens the macro-targets screen with source=banner so
 * the editor knows to bounce back here on save.
 *
 * No dismiss by design — per Sprint 2.5 T5, if the user could
 * dismiss this, they'd lose the entry point into the macro layer
 * and the Comidas tab would be unreachable. The banner is ambient
 * noise for users who opt out; we accept that trade.
 */
export function DefineTargetsBanner() {
  const router = useRouter()

  return (
    <View style={styles.card}>
      <Text style={styles.label}>TRACKING DE COMIDAS</Text>
      <Text style={styles.headline}>Define tus metas diarias</Text>
      <Text style={styles.editorial}>para activar el seguimiento de proteína y calorías.</Text>
      <View style={styles.divider} />
      <Pressable
        onPress={() => router.push('/onboarding/macro-targets?source=banner')}
        style={styles.cta}
        accessibilityRole="button"
        accessibilityLabel="Configurar metas de macros"
      >
        <Text style={styles.ctaLabel}>Configurar metas</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.creamPaper,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.forestDeep,
    letterSpacing: typography.letterSpacing.display,
    marginTop: spacing.xs,
  },
  editorial: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.prose,
    color: colors.forestSoft,
    fontStyle: 'italic',
    lineHeight: typography.sizes.prose * typography.lineHeight.prose,
  },
  divider: {
    height: 0.5,
    borderTopWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: colors.goldMute,
    marginVertical: spacing.md,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.forestDeep,
  },
  ctaLabel: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.creamWarm,
  },
})
