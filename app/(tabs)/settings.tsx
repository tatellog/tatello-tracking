import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { clearVisitedDayOne } from '@/lib/onboardingFlags'
import { queryPersister } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'

const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

/*
 * Placeholder settings screen — richer settings (profile, HealthKit,
 * notifications) arrive in Sprint 3/4. For now: a macros goal link
 * and a sign-out entry. Theme toggle stays post-MVP.
 *
 * Sign-out is treated as destructive: confirmation, then a coordinated
 * cleanup — wipe the in-memory query cache + the persisted copy in
 * AsyncStorage + the Día 1 flag — before calling supabase signOut.
 * Skipping any of those leaks the previous user's state into the next
 * sign-in (the brief, photos, profile, etc. would render with stale
 * data, which is both jarring and a privacy concern for body photos).
 */
export default function SettingsScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const performSignOut = async () => {
    setSigningOut(true)
    setErrorMessage(null)
    try {
      // Local cleanup BEFORE the auth call so the route guard, which
      // runs on the auth-state-change event, doesn't briefly read
      // stale cache.
      qc.clear()
      await Promise.all([queryPersister.removeClient(), clearVisitedDayOne()])

      const { error } = await supabase.auth.signOut()
      if (error) throw error

      // RouteGuard reacts to the session-cleared event and pushes
      // /auth, but that takes a tick — call replace ourselves so the
      // settings screen exits immediately without a flash.
      router.replace('/auth')
    } catch (err) {
      setSigningOut(false)
      const message = err instanceof Error ? err.message : 'No pudimos cerrar sesión.'
      setErrorMessage(message)
    }
  }

  const handleSignOut = () => {
    if (signingOut) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})

    // Web's Alert polyfill is a confirm() dialog — same UX, different
    // chrome. Native gets a real action sheet with a destructive
    // style on the confirm button.
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        typeof window.confirm === 'function' &&
        window.confirm('¿Cerrar sesión? Tus datos en este dispositivo se limpian.')
      if (ok) void performSignOut()
      return
    }
    Alert.alert(
      '¿Cerrar sesión?',
      'Tus datos en este dispositivo se limpian. Podés volver a entrar con el mismo email cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => void performSignOut() },
      ],
    )
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
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => [
              styles.signOut,
              pressed && !signingOut && styles.signOutPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ busy: signingOut }}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.inkPrimary} size="small" />
            ) : (
              <Text style={styles.signOutLabel}>Cerrar sesión</Text>
            )}
          </Pressable>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutPressed: {
    opacity: 0.85,
  },
  signOutLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
  },
  errorText: {
    marginTop: spacing.sm,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.feedbackError,
  },
  footer: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel + 1,
    color: colors.labelDim,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
