import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, radius, spacing, typography } from '@/theme'

type Props = {
  onRetry: () => void
}

export function HomeError({ onRetry }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.stack}>
        <Text style={styles.meta}>SIN CONEXIÓN</Text>
        <Text style={styles.headline}>No pudimos traer tu brief</Text>
        <Text style={styles.editorial}>
          Revisa tu conexión o intenta de nuevo en un momento. Tus registros y tus medidas siguen a
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
    backgroundColor: colors.bg,
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
    color: colors.niebla,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.leche,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  editorial: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.magenta,
  },
  retryLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bg,
  },
})
