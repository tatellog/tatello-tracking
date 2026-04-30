import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Welcome card shown on the user's first 2-3 days, when the
 * suggestion RPC still returns an empty array. Without it, a
 * brand-new user would open the screen and see only blank manual
 * inputs — which reads as a forgotten form. The card explains why
 * the inputs are there and what's coming once they have history.
 *
 * Design language matches the FilledMealCard surface (rounded, soft
 * mauve accent) but at a quieter intensity — this is information,
 * not a CTA.
 */
export function EmptyMealsWelcome() {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>✦</Text>
      </View>
      <Text style={styles.title}>Tu primera comida</Text>
      <Text style={styles.subtitle}>
        Cuando empieces a registrar, te <Text style={styles.subtitleEmphasis}>sugeriremos</Text> tus
        comidas favoritas para que captures rápido.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168, 94, 124, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: {
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.mauveDeep,
    lineHeight: 24,
  },
  title: {
    fontFamily: typography.displayMedium,
    fontSize: 18,
    letterSpacing: -0.4,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 19,
    color: colors.labelMuted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  subtitleEmphasis: {
    fontFamily: typography.uiSemi,
    color: colors.mauveDeep,
  },
})
