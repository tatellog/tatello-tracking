import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, radius, spacing, typography } from '@/theme'

type Props = {
  onRetry: () => void
}

/*
 * Shown when the brief query errors and there's nothing cached to
 * fall back on. Intentionally minimal — no animation, no motion;
 * the moment of failure is when the user needs clarity, not flair.
 * A single retry button sits below a one-line prose explanation,
 * matching the editorial voice of the rest of the app.
 */
export function HomeError({ onRetry }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.stack}>
        <Text style={styles.meta}>SIN CONEXIÓN</Text>
        <Text style={styles.headline}>No pudimos traer tu brief</Text>
        <Text style={styles.editorial}>
          Revisá tu conexión o intentá de nuevo en un momento. Tu racha y tus medidas siguen a
          salvo.
        </Text>
        <Pressable onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryLabel}>Reintentar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pearlBase,
    paddingHorizontal: spacing.xl,
  },
  stack: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
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
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.labelMuted,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.mauveDeep,
  },
  retryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.pearlBase,
  },
})
