import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'

const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

/*
 * Placeholder settings screen — Sprint 2 spec T13 calls for a
 * single sign-out entry; richer settings arrive in Sprint 3/4
 * alongside profile, goals, HealthKit and so on. The theme toggle
 * that used to live here is gone: dark mode is post-MVP, and the
 * header moon icon is decorative only.
 */
export default function SettingsScreen() {
  const handleSignOut = () => {
    supabase.auth.signOut().catch(() => {})
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <Text style={styles.headline}>Ajustes</Text>
          <Text style={styles.meta}>tracking-app · v1.0.0</Text>
        </Animated.View>

        <Animated.View entering={enter(150)}>
          <Pressable onPress={handleSignOut} style={styles.signOut}>
            <Text style={styles.signOutLabel}>Cerrar sesión</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={enter(280)}>
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
    gap: spacing.xxl,
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
