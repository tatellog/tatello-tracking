import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'

const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

/*
 * Placeholder settings screen — richer settings (profile, HealthKit,
 * notifications) arrive in Sprint 3/4. For now: a macros goal link
 * and a sign-out entry. Theme toggle stays post-MVP.
 */
export default function SettingsScreen() {
  const router = useRouter()

  const handleSignOut = () => {
    supabase.auth.signOut().catch(() => {})
  }

  const editTargets = () => {
    router.push('/onboarding/macro-targets?source=settings')
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <Text style={styles.headline}>Ajustes</Text>
          <Text style={styles.meta}>tracking-app · v1.0.0</Text>
        </Animated.View>

        <Animated.View entering={enter(150)} style={styles.group}>
          <Text style={styles.sectionLabel}>NUTRICIÓN</Text>
          <Pressable onPress={editTargets} style={styles.row} accessibilityRole="button">
            <Text style={styles.rowLabel}>Editar metas diarias</Text>
            <Text style={styles.rowHint}>›</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={enter(220)}>
          <Pressable onPress={handleSignOut} style={styles.signOut}>
            <Text style={styles.signOutLabel}>Cerrar sesión</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={enter(320)}>
          <Text style={styles.footer}>Un acto silencioso cada mañana</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.xl,
  },
  headline: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.anchor,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  meta: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelDim,
    marginTop: spacing.xs,
  },
  group: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.tile,
    backgroundColor: colors.pearlBase,
    borderWidth: 0.5,
    borderColor: colors.borderDashed,
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
  },
  rowHint: {
    color: colors.labelMuted,
    fontSize: 18,
  },
  signOut: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.borderDashed,
    backgroundColor: colors.pearlMuted,
  },
  signOutLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
  },
  footer: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel + 1,
    color: colors.labelDim,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
