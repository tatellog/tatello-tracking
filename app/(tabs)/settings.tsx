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
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useMacroTargets } from '@/features/macros/hooks'
import { useProfile } from '@/features/profile/hooks'
import { clearVisitedDayOne } from '@/lib/onboardingFlags'
import { queryPersister } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'

const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

const SEX_LABEL: Record<string, string> = {
  female: 'Femenino',
  male: 'Masculino',
}

const GOAL_LABEL: Record<string, string> = {
  recomposition: 'Recomposición',
  lose_fat: 'Bajar grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantener',
}

/*
 * Settings hub. Three blocks:
 *   1. Mi perfil — read-only summary of the wizard answers (name,
 *      age, height, sex, goal). Editing happens from the onboarding
 *      flow today; an inline edit lands in a future sprint.
 *   2. Mis metas — current macro targets with a tap-to-edit row that
 *      reuses /onboarding/macro-targets (?source=settings). Building
 *      a separate modal would duplicate functionality with no upside.
 *   3. Cuenta — sign out + version.
 *
 * Sign-out is destructive: confirmation, then a coordinated cleanup
 * (in-memory query cache + persisted store + visited-day-one flag)
 * before signOut. Skipping any of those leaks the previous user's
 * brief / photos / profile into the next sign-in.
 */
export default function SettingsScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: targets } = useMacroTargets()

  const [signingOut, setSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const performSignOut = async () => {
    setSigningOut(true)
    setErrorMessage(null)
    try {
      qc.clear()
      await Promise.all([queryPersister.removeClient(), clearVisitedDayOne()])

      const { error } = await supabase.auth.signOut()
      if (error) throw error
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

  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null
  const sexLabel = profile?.biological_sex ? (SEX_LABEL[profile.biological_sex] ?? '—') : '—'
  const goalLabel = profile?.goal ? (GOAL_LABEL[profile.goal] ?? '—') : '—'

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(0)}>
          <Text style={styles.headline}>Ajustes</Text>
          <Text style={styles.meta}>tracking-app · v1.0.0</Text>
        </Animated.View>

        <Animated.View entering={enter(120)} style={styles.group}>
          <Text style={styles.sectionLabel}>MI PERFIL</Text>
          <View style={styles.profileCard}>
            <ProfileItem label="Nombre" value={profile?.display_name ?? '—'} />
            <Divider />
            <ProfileItem label="Edad" value={age != null ? `${age} años` : '—'} />
            <Divider />
            <ProfileItem
              label="Altura"
              value={profile?.height_cm ? `${profile.height_cm} cm` : '—'}
            />
            <Divider />
            <ProfileItem label="Sexo biológico" value={sexLabel} />
            <Divider />
            <ProfileItem label="Objetivo" value={goalLabel} />
          </View>
        </Animated.View>

        <Animated.View entering={enter(200)} style={styles.group}>
          <Text style={styles.sectionLabel}>MIS METAS</Text>
          <Pressable onPress={editTargets} style={styles.row} accessibilityRole="button">
            <View style={styles.rowMain}>
              <Text style={styles.rowLabel}>Macros diarios</Text>
              <Text style={styles.rowSub}>
                {targets
                  ? `${targets.protein_g}g proteína · ${targets.calories} cal`
                  : 'Definir metas'}
              </Text>
            </View>
            <Text style={styles.rowHint}>›</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={enter(280)} style={styles.group}>
          <Text style={styles.sectionLabel}>CUENTA</Text>
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

        <Animated.View entering={enter(360)}>
          <Text style={styles.footer}>Un acto silencioso cada mañana</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileItem}>
      <Text style={styles.profileItemLabel}>{label}</Text>
      <Text style={styles.profileItemValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function Divider() {
  return <View style={styles.divider} />
}

function calculateAge(iso: string): number {
  const parts = iso.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  const birth = new Date(y, m - 1, d)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const md = today.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1
  return age
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
  profileCard: {
    borderRadius: radius.tile,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  profileItemLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.labelMuted,
  },
  profileItemValue: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.tile,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.inkPrimary,
  },
  rowSub: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    color: colors.labelMuted,
  },
  rowHint: {
    color: colors.labelMuted,
    fontSize: 18,
    marginLeft: spacing.md,
  },
  signOut: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
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
