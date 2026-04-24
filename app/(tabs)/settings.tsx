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
    backgroundColor: colors.creamWarm,
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
    color: colors.forestDeep,
    letterSpacing: typography.letterSpacing.display,
  },
  meta: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldSoft,
    marginTop: spacing.xs,
  },
  group: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.input,
    backgroundColor: colors.creamSoft,
    borderWidth: 0.5,
    borderColor: colors.goldAlpha20,
  },
  rowLabel: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.forestDeep,
  },
  rowHint: {
    color: colors.goldBurnt,
    fontSize: 18,
  },
  signOut: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: colors.goldAlpha25,
    backgroundColor: colors.overlayWhite40,
  },
  signOutLabel: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.forestDeep,
  },
  footer: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.smallLabel + 1,
    fontStyle: 'italic',
    color: colors.goldSoft,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
