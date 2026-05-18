import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { StarLoader } from '@/components/StarLoader'
import { useMacroTargets } from '@/features/macros/hooks'
import { avatarUrl } from '@/features/profile/api'
import { useProfile, useUploadAvatar } from '@/features/profile/hooks'
import { SectionHeader, SkyBackground, TabHeader } from '@/features/tabs/components'
import { ZODIAC, ZodiacFigure, zodiacFromDate } from '@/features/tabs/zodiac'
import { confirmBinary, useConfirm } from '@/lib/confirm'
import { clearVisitedDayOne } from '@/lib/onboardingFlags'
import { queryPersister } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { colors, typography } from '@/theme'

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
 * Settings hub, in the app's celestial-editorial language. Three
 * blocks under a TabHeader:
 *   1. Mi perfil — an identity card. The name leads as a title; below
 *      it the zodiac sign + age tie back to the Hoy-tab constellation
 *      ("Tu Acuario"). The remaining wizard answers sit as quiet rows.
 *   2. Mis metas — the macro targets as a tappable card; tapping it
 *      reuses /onboarding/macro-targets (?source=settings).
 *   3. Cuenta — sign out.
 *
 * Sign-out is destructive: confirmation, then a coordinated cleanup
 * (in-memory query cache + persisted store + visited-day-one flag)
 * before signOut — skipping any leaks the previous user's data into
 * the next sign-in.
 */
export default function SettingsScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const choose = useConfirm()
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

  const handleSignOut = async () => {
    if (signingOut) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})

    const ok = await confirmBinary(choose, {
      title: '¿Cerrar sesión?',
      description:
        'Tus datos en este dispositivo se limpian. Podés volver a entrar con el mismo email cuando quieras.',
      confirmLabel: 'Cerrar sesión',
      destructive: true,
    })
    if (ok) void performSignOut()
  }

  const editTargets = () => {
    router.push('/onboarding/macro-targets?source=settings')
  }

  const editProfile = () => {
    router.push('/onboarding/about-you?source=settings')
  }

  const uploadAvatar = useUploadAvatar()

  const pickAvatar = async () => {
    if (uploadAvatar.isPending) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    })
    const asset = result.canceled ? null : result.assets[0]
    if (asset) uploadAvatar.mutate(asset.uri)
  }

  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null
  const sexLabel = profile?.biological_sex ? (SEX_LABEL[profile.biological_sex] ?? '—') : '—'
  const goalLabel = profile?.goal ? (GOAL_LABEL[profile.goal] ?? '—') : '—'

  // Celestial identity line — sign comes from the same source as the
  // Hoy-tab constellation, so the two screens agree.
  const zodiacSign = profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null
  const signLabel = zodiacSign ? ZODIAC[zodiacSign].label : null
  const identityLine = [signLabel, age != null ? `${age} años` : null].filter(Boolean).join('  ·  ')

  const avatarUri = profile?.avatar_path ? avatarUrl(profile.avatar_path) : null
  const initial = (profile?.display_name?.trim().charAt(0) || '✦').toUpperCase()

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)}>
            <TabHeader title="Ajustes" pillLabel="STELAR · v1.0.0" />
          </Animated.View>

          {/* ── Mi perfil — the identity card, tap to edit. ── */}
          <Animated.View entering={enter(100)}>
            <SectionHeader label="Mi perfil" />
            <Pressable
              onPress={editProfile}
              accessibilityRole="button"
              accessibilityLabel="Editar mi perfil"
            >
              <View style={styles.profileCard}>
                <View style={styles.identity}>
                  {/* Avatar — its own tap target: tap it to change the
                      photo, tap the rest of the card to edit profile. */}
                  <Pressable
                    onPress={pickAvatar}
                    disabled={uploadAvatar.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar foto de perfil"
                  >
                    <View style={styles.avatar}>
                      {uploadAvatar.isPending ? (
                        <StarLoader size={16} color={colors.magenta} />
                      ) : avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                      ) : zodiacSign ? (
                        <ZodiacFigure sign={zodiacSign} size={30} color={colors.magenta} />
                      ) : (
                        <Text style={styles.avatarInitial}>{initial}</Text>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.identityText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {profile?.display_name ?? '—'}
                    </Text>
                    {identityLine ? <Text style={styles.signAge}>{identityLine}</Text> : null}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
                <View style={styles.cardDivider} />
                <ProfileRow
                  label="Altura"
                  value={profile?.height_cm ? `${profile.height_cm} cm` : '—'}
                />
                <ProfileRow label="Sexo biológico" value={sexLabel} />
                <ProfileRow label="Objetivo" value={goalLabel} />
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Mis metas — macros, tap to edit. ── */}
          <Animated.View entering={enter(190)}>
            <SectionHeader label="Mis metas" />
            <Pressable
              onPress={editTargets}
              accessibilityRole="button"
              accessibilityLabel="Editar macros diarios"
            >
              <View style={styles.metaCard}>
                <View style={styles.metaMain}>
                  <Text style={styles.metaLabel}>Macros diarios</Text>
                  {targets ? (
                    <Text style={styles.metaValue}>
                      <Text style={styles.metaNum}>{targets.protein_g}</Text> g proteína
                      {'   ·   '}
                      <Text style={styles.metaNum}>{targets.calories}</Text> kcal
                    </Text>
                  ) : (
                    <Text style={styles.metaValue}>Aún sin definir</Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Cuenta. ── */}
          <Animated.View entering={enter(280)}>
            <SectionHeader label="Cuenta" />
            <Pressable
              onPress={handleSignOut}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityState={{ busy: signingOut }}
            >
              <View style={styles.signOut}>
                {signingOut ? (
                  <StarLoader size={18} color={colors.leche} />
                ) : (
                  <Text style={styles.signOutLabel}>Cerrar sesión</Text>
                )}
              </View>
            </Pressable>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </Animated.View>

          <Animated.View entering={enter(370)}>
            <Text style={styles.footer}>
              Un acto <Text style={styles.footerEm}>silencioso</Text> cada mañana.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
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
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  // ── Mi perfil ──────────────────────────────────────────────────
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  // The identity block — name as title, sign + age beneath.
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  // Avatar — magenta-rimmed circle; holds the photo, the initial, or
  // an upload spinner. Tapping it opens the image picker.
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 52,
    height: 52,
  },
  avatarInitial: {
    fontFamily: typography.displayHeavy,
    fontSize: 22,
    color: colors.magenta,
  },
  name: {
    fontFamily: typography.displayHeavy,
    fontSize: 22,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  signAge: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.niebla,
    marginTop: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 15.5,
    color: colors.niebla,
  },
  rowValue: {
    fontFamily: typography.displaySemi,
    fontSize: 15.5,
    color: colors.bone,
    letterSpacing: -0.2,
    flexShrink: 1,
    textAlign: 'right',
  },
  // ── Mis metas ──────────────────────────────────────────────────
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  metaMain: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: typography.displaySemi,
    fontSize: 16.5,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  metaValue: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.niebla,
    marginTop: 4,
  },
  metaNum: {
    fontFamily: typography.displaySemi,
    fontStyle: 'normal',
    color: colors.bone,
  },
  chevron: {
    fontFamily: typography.ui,
    fontSize: 22,
    color: colors.niebla,
  },
  // ── Cuenta ─────────────────────────────────────────────────────
  signOut: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: {
    fontFamily: typography.uiBold,
    fontSize: 15,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  errorText: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.feedbackError,
  },
  // Editorial sign-off — serif italic with one magenta word.
  footer: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
    marginTop: 32,
  },
  footerEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
})
