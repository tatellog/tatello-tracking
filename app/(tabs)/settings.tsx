import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useRouter } from 'expo-router'
import { type ReactNode, useCallback, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BetaFeedbackSheet } from '@/components/BetaFeedbackSheet'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StarLoader } from '@/components/StarLoader'
import { track } from '@/lib/analytics'
import { useMacroTargets } from '@/features/macros/hooks'
import { useLatestPhotoSet } from '@/features/onboarding/photos/hooks/useLatestPhotoSet'
import { avatarUrl } from '@/features/profile/api'
import { useDeleteAccount, useProfile, useUploadAvatar } from '@/features/profile/hooks'
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

// TODO: Términos y privacidad — la fila "Términos y privacidad" está
// disabled hasta que estas páginas estén hospedadas. Cuando existan,
// agregar las URLs y reactivar la fila (onPress → Linking.openURL).
// Feedback se canaliza por el BetaFeedbackSheet, no por mailto.

/** monthly_focus → settings display, mirrors the wizard's intention
 *  step. The 5 ACTIVE options (weight/energy/food/patterns/other) carry
 *  the EXACT same label + tagline the user saw in the wizard, so Settings
 *  reads as a continuation of that voice. sleep/cycle/mind are INERT —
 *  pruned from the wizard UI but kept here so legacy rows that still carry
 *  those values render a label instead of falling through to null. */
const FOCUS_LABEL: Record<string, { label: string; tagline: string }> = {
  weight: { label: 'Bajar de peso', tagline: 'Stelar trabaja para que se sostenga.' },
  energy: { label: 'Recuperar mi energía', tagline: 'De tu energía nace la constancia.' },
  food: { label: 'Entender cómo me alimento', tagline: 'Qué se repite alrededor de comer.' },
  patterns: { label: 'Entender mis patrones', tagline: 'Qué hace los viernes distintos.' },
  other: { label: 'Algo más', tagline: 'La nombras tú.' },
  // ── Inert: pruned from the wizard UI, kept for legacy rows only. ──
  sleep: { label: 'Dormir profundo', tagline: 'La noche se vuelve descanso' },
  cycle: { label: 'Conocer mi ciclo', tagline: 'Tu cuerpo va a hablarte' },
  mind: { label: 'Calmar la mente', tagline: 'Menos ruido por dentro' },
}

/*
 * Settings hub, in the app's celestial-editorial language. Sections:
 *   1. Mi perfil — identity (name + zodiac + age + altura + sexo).
 *      Tappable card: opens /onboarding/about-you?source=settings.
 *   2. Tu plan — the three levers the user controls, grouped into a
 *      single section with one tappable card each: intención del mes,
 *      macros diarios, seguimiento corporal.
 *   3. Cómo te lee Stelar — one line naming what the intelligence reads.
 *   4. Cuenta — the data-ownership line, account actions (notificaciones,
 *      escríbenos, términos), sign out, and the destructive delete row.
 *
 * Three remote reads feed this screen: useProfile (the heart — name,
 * zodiac, intención), useMacroTargets, useLatestPhotoSet. Each is read
 * with its loading state so the screen never shows "—" / "Aún sin definir"
 * while a query is still in flight (that reads like the data was wiped).
 * Loading → neutral skeleton; resolved-and-null → the warm empty copy;
 * profile error → a tappable retry line.
 *
 * Both sign-out and delete-account are destructive: each is a two-step
 * confirmBinary, then a coordinated teardown (in-memory query cache +
 * persisted store + visited-day-one flag) before signOut — skipping any
 * leaks the previous user's data into the next sign-in. Delete's teardown
 * lives in the useDeleteAccount hook; sign-out's lives here.
 */
export default function SettingsScreen() {
  return (
    <ErrorBoundary screen="ajustes">
      <SettingsBody />
    </ErrorBoundary>
  )
}

function SettingsBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'ajustes' })
    }, []),
  )
  const [feedbackVisible, setFeedbackVisible] = useState(false)
  const router = useRouter()
  const qc = useQueryClient()
  const choose = useConfirm()

  // The three remote reads — we keep their loading state, not just data, so
  // we can tell "still loading" apart from "genuinely empty".
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    isSuccess: profileLoaded,
    refetch: refetchProfile,
  } = useProfile()
  // useMacroTargets is derived from the brief query and exposes only
  // data / isLoading / isError / refetch (no isSuccess) — so we treat
  // "resolved" as "not loading".
  const { data: targets, isLoading: targetsLoading } = useMacroTargets()
  const { data: lastPhotoSetAt, isLoading: photoLoading } = useLatestPhotoSet()

  const [signingOut, setSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const deleteAccount = useDeleteAccount()

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
        'Tus datos en este dispositivo se limpian. Puedes volver a entrar con el mismo email cuando quieras.',
      confirmLabel: 'Cerrar sesión',
      destructive: true,
    })
    if (ok) void performSignOut()
  }

  // Delete account — double-step confirm, then the hook's teardown
  // (clear cache + persister + flags + signOut). Navigation is ours: on
  // success the session is already gone, so we replace to /auth. The hook
  // surfaces isPending (StarLoader) + error (tappable retry line).
  const handleDeleteAccount = async () => {
    if (deleteAccount.isPending) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})

    const ok = await confirmBinary(choose, {
      title: '¿Eliminar tu cuenta?',
      description:
        'Esto borra tu cuenta y todo lo que vive en ella: tu perfil, tus datos, tu cielo. No hay vuelta atrás.',
      confirmLabel: 'Eliminar todo',
      cancelLabel: 'Mejor no',
      destructive: true,
    })
    if (!ok) return

    deleteAccount.mutate(undefined, {
      onSuccess: () => router.replace('/auth'),
    })
  }

  const editTargets = () => {
    router.push('/onboarding/macro-targets?source=settings')
  }

  const editProfile = () => {
    router.push('/onboarding/about-you?source=settings')
  }

  const editIntention = () => {
    router.push('/onboarding/intention?source=settings')
  }

  const openBodyTrack = () => {
    router.push('/onboarding/photos/front?source=settings')
  }

  const editNotifications = () => {
    router.push('/onboarding/notifications?source=settings')
  }

  // Status line for the Track corporal card. While the query is in flight
  // we hand back null so the row shows a neutral skeleton instead of
  // "Aún sin fotos" (which would read as "your photos were deleted"). We
  // only commit to the empty copy once the query has actually resolved.
  const bodyTrackStatus = (() => {
    if (photoLoading) return null
    if (lastPhotoSetAt == null) return 'Aún sin fotos'
    const days = Math.max(0, Math.floor((Date.now() - lastPhotoSetAt) / (1000 * 60 * 60 * 24)))
    if (days === 0) return 'Capturado hoy'
    if (days === 1) return 'Hace 1 día'
    return `Hace ${days} días`
  })()

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
  const sexLabel = profile?.biological_sex ? (SEX_LABEL[profile.biological_sex] ?? null) : null
  const intention = profile?.monthly_focus ? (FOCUS_LABEL[profile.monthly_focus] ?? null) : null
  // Secondary focuses (the picks AFTER the priority in the intention
  // wizard). Each one resolves to its label via FOCUS_LABEL; values we
  // don't know how to label (a hypothetical out-of-enum row) drop out.
  const secondaryIntentionLabels: string[] = (profile?.monthly_focus_secondary ?? [])
    .map((v) => FOCUS_LABEL[v]?.label)
    .filter((s): s is string => typeof s === 'string')
  // Truncate the secondary list: show at most 2, fold the rest into a
  // quiet "y N más" so a heavy multi-pick can't crowd the priority. The
  // dimmer metaSecondary style carries the hierarchy; no "También:" label.
  const SECONDARY_VISIBLE = 2
  const secondaryLine = (() => {
    if (secondaryIntentionLabels.length === 0) return null
    const shown = secondaryIntentionLabels.slice(0, SECONDARY_VISIBLE)
    const rest = secondaryIntentionLabels.length - shown.length
    const parts = [...shown]
    if (rest > 0) parts.push(`y ${rest} más`)
    return parts.join('  ·  ')
  })()

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

          {/* ── Mi perfil — the identity card, tap to edit. The whole card
              is one "Editar perfil" target: the header row carries the
              chevron, and Altura / Sexo read as the SAME card's lower
              detail rows (a hint line under them names the gesture), not a
              separate static list. The profile is the heart, so this block
              owns the loading / error states for the screen. ── */}
          <Animated.View entering={enter(100)}>
            <SectionHeader label="Mi perfil" />
            {profileError ? (
              <ProfileErrorCard onRetry={() => void refetchProfile()} />
            ) : profileLoading ? (
              <ProfileSkeleton />
            ) : (
              <Pressable
                onPress={editProfile}
                accessibilityRole="button"
                accessibilityLabel="Editar mi perfil"
                accessibilityHint="Abre el editor de perfil"
                style={({ pressed }) => pressed && styles.rowPressed}
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
                        {profile?.display_name ?? 'Aún sin nombre'}
                      </Text>
                      {identityLine ? <Text style={styles.signAge}>{identityLine}</Text> : null}
                    </View>
                    <Text
                      style={styles.chevron}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      ›
                    </Text>
                  </View>
                  <View style={styles.cardDivider} />
                  {/* Detail rows — read-only values that belong to the same
                      "edit profile" gesture as the header. The hint line
                      below them names the gesture so they don't read as an
                      orphaned static list. */}
                  <ProfileRow
                    label="Altura"
                    value={profile?.height_cm ? `${profile.height_cm} cm` : 'Aún sin definir'}
                  />
                  <ProfileRow label="Sexo biológico" value={sexLabel ?? 'Aún sin definir'} />
                  <Text style={styles.cardHint}>Toca para editar tu perfil</Text>
                </View>
              </Pressable>
            )}
            {/* Avatar upload error — silent failure was the old behaviour;
                now we name it warmly without blame. */}
            {uploadAvatar.isError ? (
              <Pressable
                onPress={pickAvatar}
                accessibilityRole="button"
                accessibilityLabel="Reintentar cambiar la foto"
              >
                <Text style={styles.inlineError}>
                  No pudimos cambiar tu foto. Toca para reintentar.
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>

          {/* ── Tu plan — the three levers the user controls. One section
              header over three distinct cards. Each row shows a neutral
              skeleton while its query is in flight; the empty copy only
              appears once the query has resolved. ── */}
          <Animated.View entering={enter(150)}>
            <SectionHeader label="Tu plan" />
            <PlanRow
              label={
                profileLoaded ? (intention?.label ?? 'Aún sin definir') : 'Tu intención del mes'
              }
              onPress={editIntention}
              accessibilityLabel="Editar tu intención"
              valueNode={
                !profileLoaded ? (
                  <SkeletonLine width="62%" />
                ) : (
                  <>
                    <Text style={styles.metaValue}>
                      {intention?.tagline ?? 'Toca para elegir un foco'}
                    </Text>
                    {/* Secondary focuses — whispered as a dimmer line below
                        the tagline so the priority stays the read. Truncated
                        to 2 + "y N más", single line, no "También:" label. */}
                    {secondaryLine ? (
                      <Text style={styles.metaSecondary} numberOfLines={1}>
                        {secondaryLine}
                      </Text>
                    ) : null}
                  </>
                )
              }
            />
            <PlanRow
              label="Macros diarios"
              onPress={editTargets}
              accessibilityLabel="Editar macros diarios"
              valueNode={
                targetsLoading ? (
                  <SkeletonLine width="70%" />
                ) : targets ? (
                  <Text style={styles.metaValue}>
                    <Text style={styles.metaNum}>{targets.protein_g}</Text> g proteína
                    {'   ·   '}
                    <Text style={styles.metaNum}>{targets.calories}</Text> kcal
                  </Text>
                ) : (
                  <Text style={styles.metaValue}>Aún sin definir</Text>
                )
              }
            />
            <PlanRow
              label="Seguimiento corporal"
              onPress={openBodyTrack}
              accessibilityLabel="Abrir seguimiento corporal"
              valueNode={
                bodyTrackStatus == null ? (
                  <SkeletonLine width="48%" />
                ) : (
                  <Text style={styles.metaValue}>{bodyTrackStatus}</Text>
                )
              }
              last
            />
          </Animated.View>

          {/* ── Cómo te lee Stelar — one line naming what the intelligence
              reads. ── */}
          <Animated.View entering={enter(200)}>
            <SectionHeader label="Cómo te lee Stelar" />
            <View style={styles.stelarCard}>
              <Text style={styles.stelarBody}>
                Stelar lee{' '}
                <Text style={styles.stelarAccent}>
                  tu sueño, tus comidas, tu movimiento, tu ánimo
                </Text>
                , encuentra tus patrones y escribe cada lectura de Tu Órbita.
              </Text>
            </View>
          </Animated.View>

          {/* ── Cuenta — the data-ownership promise + account actions +
              the destructive zone (sign out, delete). ── */}
          <Animated.View entering={enter(240)}>
            <SectionHeader label="Cuenta" />
            <Text style={styles.privacyLine}>
              <Text style={styles.privacyStrong}>Tus datos son tuyos.</Text> Viven en tu cuenta y
              nadie más los lee.
            </Text>

            <BetaFeedbackSheet
              visible={feedbackVisible}
              onClose={() => setFeedbackVisible(false)}
            />

            {/* Account-action list — same tappable-row vocabulary as Tu plan,
                grouped into one card with internal hairline dividers since
                they're a related cluster. Feedback reuses the existing
                BetaFeedbackSheet design. Términos stays disabled until the
                pages are hosted (see the TODO near the top of the file). */}
            <View style={styles.accountCard}>
              <AccountRow
                label="Notificaciones"
                tagline="Tú eliges cuándo aparecemos."
                onPress={editNotifications}
                accessibilityLabel="Editar notificaciones"
              />
              <View style={styles.accountDivider} />
              <AccountRow
                label="Feedback"
                tagline="Lo que sea, lo leemos."
                onPress={() => setFeedbackVisible(true)}
                accessibilityLabel="Danos tu feedback"
              />
              <View style={styles.accountDivider} />
              <AccountRow
                label="Términos y privacidad"
                tagline="Pronto."
                accessibilityLabel="Términos y privacidad, próximamente"
                disabled
              />
            </View>

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

            {/* Delete account — the most destructive action, kept last and
                in muted red so it stays subordinate to the magenta voice, but
                with button chrome (border + faint tint) so it reads as
                tappable rather than floating text. Spinner while the hook's
                teardown runs; a tappable retry line on error. */}
            <Pressable
              onPress={handleDeleteAccount}
              disabled={deleteAccount.isPending}
              accessibilityRole="button"
              accessibilityLabel="Eliminar mi cuenta"
              accessibilityState={{ busy: deleteAccount.isPending }}
              style={({ pressed }) => [styles.deleteRow, pressed && styles.rowPressed]}
            >
              {deleteAccount.isPending ? (
                <View style={styles.deletePending}>
                  <StarLoader size={14} color={colors.feedbackError} />
                  <Text style={styles.deletePendingLabel}>Borrando tu cuenta...</Text>
                </View>
              ) : (
                <Text style={styles.deleteLabel}>Eliminar mi cuenta</Text>
              )}
            </Pressable>
            {deleteAccount.error ? (
              <Text style={styles.errorText}>
                No pudimos eliminar tu cuenta ahora. Toca para reintentar.
              </Text>
            ) : null}

            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/dev-constellations')}
                accessibilityRole="button"
                style={{
                  marginTop: 18,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(217, 174, 111, 0.4)',
                  backgroundColor: 'rgba(217, 174, 111, 0.06)',
                  alignSelf: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.serifSemi,
                    fontStyle: 'italic',
                    fontSize: typography.sizes.bodyLarge,
                    color: colors.bone,
                    letterSpacing: 0.6,
                  }}
                >
                  ✦ DEV — ver todas las constelaciones
                </Text>
              </Pressable>
            ) : null}
            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/refactor-test')}
                accessibilityRole="button"
                style={{
                  marginTop: 10,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(217, 174, 111, 0.4)',
                  backgroundColor: 'rgba(217, 174, 111, 0.06)',
                  alignSelf: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: typography.serifSemi,
                    fontStyle: 'italic',
                    fontSize: typography.sizes.bodyLarge,
                    color: colors.bone,
                    letterSpacing: 0.6,
                  }}
                >
                  ✦ DEV — refactor-test (constellation strangler)
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>

          <Animated.View entering={enter(320)}>
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

/* A "Tu plan" item — its own bordered card: a bold label, a sub-value
 * (a plain string via `value`, or a rich node via `valueNode` for the
 * macros / skeleton lines) and a chevron. Three of these stack under a
 * single section header. `last` drops the bottom margin so the section
 * doesn't over-pad before the next header. */
function PlanRow({
  label,
  value,
  valueNode,
  onPress,
  accessibilityLabel,
  last,
}: {
  label: string
  value?: string
  valueNode?: ReactNode
  onPress: () => void
  accessibilityLabel: string
  last?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        last ? styles.planWrapLast : styles.planWrap,
        pressed && styles.rowPressed,
      ]}
    >
      {/* The card's border + fill live on this inner View, not on the
          Pressable — border/background don't render reliably when
          applied straight to a Pressable in this RN setup. */}
      <View style={styles.planCard}>
        <View style={styles.metaMain}>
          <Text style={styles.metaLabel}>{label}</Text>
          {valueNode ?? <Text style={styles.metaValue}>{value}</Text>}
        </View>
        <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </View>
    </Pressable>
  )
}

/* A "Cuenta" action row — a single tappable line inside the account card:
 * a bold label, an optional tagline beneath it, and a chevron. Rows are
 * separated by a hairline divider rendered by the parent. onLongPress is an
 * optional secondary action (used so "Términos y privacidad" can also reach
 * the privacy URL). minHeight keeps a 44pt+ target even without a tagline. */
function AccountRow({
  label,
  tagline,
  onPress,
  onLongPress,
  accessibilityLabel,
  disabled,
}: {
  label: string
  tagline?: string
  onPress?: () => void
  onLongPress?: () => void
  accessibilityLabel: string
  // Dimmed, non-tappable, no chevron — e.g. Términos until the pages exist.
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => pressed && !disabled && styles.rowPressed}
    >
      {/* Row layout lives on this inner View, not the Pressable — same
          reason PlanRow does it: flex doesn't render reliably when applied
          straight to a Pressable in this RN setup, which left the chevron
          stacking below the text instead of aligning right. */}
      <View style={[styles.accountRow, disabled && styles.accountRowDisabled]}>
        <View style={styles.metaMain}>
          <Text style={styles.accountLabel}>{label}</Text>
          {tagline ? <Text style={styles.accountTagline}>{tagline}</Text> : null}
        </View>
        {disabled ? null : (
          <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
            ›
          </Text>
        )}
      </View>
    </Pressable>
  )
}

/* Neutral placeholder bar — used inside PlanRow value slots while a query
 * is in flight, so the row reads as "loading" instead of "empty". A dim
 * hairline-filled pill; no shimmer animation (keeps it calm, no extra
 * reanimated surface to audit). */
function SkeletonLine({ width }: { width: number | `${number}%` }) {
  return <View style={[styles.skeletonLine, { width }]} accessibilityElementsHidden />
}

/* The Mi perfil card in its loading shape — same silhouette as the real
 * card (avatar circle + two text bars + two detail rows) so the layout
 * doesn't jump when the profile resolves. Calm, no shimmer. */
function ProfileSkeleton() {
  return (
    <View
      style={styles.profileCard}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.identity}>
        <View style={[styles.avatar, styles.avatarSkeleton]} />
        <View style={styles.identityText}>
          <View style={[styles.skeletonLine, styles.skeletonName]} />
          <View style={[styles.skeletonLine, styles.skeletonSub]} />
        </View>
      </View>
      <View style={styles.cardDivider} />
      <View style={styles.row}>
        <View style={[styles.skeletonLine, { width: 56 }]} />
        <View style={[styles.skeletonLine, { width: 64 }]} />
      </View>
      <View style={styles.row}>
        <View style={[styles.skeletonLine, { width: 96 }]} />
        <View style={[styles.skeletonLine, { width: 72 }]} />
      </View>
    </View>
  )
}

/* The profile failed to load — the screen's heart, so this gets a warm,
 * tappable retry line (not a buried toast). One tap re-runs the query. */
function ProfileErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Reintentar cargar tu perfil"
      style={({ pressed }) => [
        styles.profileCard,
        styles.profileErrorCard,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.profileErrorText}>
        No pudimos leer tu perfil ahora. Toca para reintentar.
      </Text>
    </Pressable>
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
  // Skeleton avatar — neutral fill, no magenta rim (nothing to celebrate
  // while loading).
  avatarSkeleton: {
    backgroundColor: colors.hairline,
    borderColor: colors.hairline,
  },
  avatarImg: {
    width: 52,
    height: 52,
  },
  avatarInitial: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.segmentTitle,
    color: colors.magenta,
  },
  name: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.segmentTitle,
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
  // Hint line under the Altura / Sexo detail rows — names the whole-card
  // gesture so those rows don't read as an orphaned static list.
  cardHint: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.3,
    color: colors.bruma,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 13,
  },
  // ── Cómo te lee Stelar ─────────────────────────────────────────
  stelarCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  stelarBody: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stelarAccent: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  // ── Cuenta — privacy line ──────────────────────────────────────
  privacyLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  privacyStrong: {
    fontFamily: typography.displaySemi,
    color: colors.bone,
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
  // ── Tu plan ────────────────────────────────────────────────────
  planWrap: {
    marginBottom: 10,
  },
  planWrapLast: {
    marginBottom: 0,
  },
  planCard: {
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
  // Whole-card press feedback — used by every tappable surface.
  rowPressed: {
    opacity: 0.6,
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
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    marginTop: 4,
  },
  // Secondary line under the priority tagline — dimmer + smaller so the
  // priority pick stays the visual read. Upright (not italic): the serif
  // italic is reserved for the coach/poetic voice; this is meta.
  metaSecondary: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: colors.bruma,
    marginTop: 6,
  },
  metaNum: {
    fontFamily: typography.displaySemi,
    fontStyle: 'normal',
    color: colors.bone,
  },
  chevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
  },
  // ── Skeleton primitives ────────────────────────────────────────
  // A dim filled pill standing in for text while a query loads. Calm,
  // static (no shimmer) — reads as "loading", never as "empty".
  skeletonLine: {
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.hairline,
    marginTop: 6,
  },
  skeletonName: {
    width: '55%',
    height: 18,
    marginTop: 0,
  },
  skeletonSub: {
    width: '38%',
    height: 12,
    marginTop: 10,
  },
  // ── Inline / profile error ─────────────────────────────────────
  profileErrorCard: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderColor: colors.hairlineStrong,
  },
  profileErrorText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 21,
    color: colors.bone,
  },
  inlineError: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.feedbackError,
    paddingHorizontal: 2,
  },
  // ── Cuenta — account-action list ───────────────────────────────
  // One card holding the tappable account rows (notificaciones, feedback,
  // términos), same vocabulary as the plan cards but grouped with internal
  // hairline dividers since they're a related cluster, not separate levers.
  accountCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    marginBottom: 18,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Min 44pt touch target even when there's no tagline.
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  // Disabled row (e.g. Términos until pages are hosted) — dimmed, no chevron.
  accountRowDisabled: {
    opacity: 0.4,
  },
  accountDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginLeft: 16,
  },
  accountLabel: {
    fontFamily: typography.displaySemi,
    fontSize: 16.5,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  accountTagline: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    marginTop: 4,
  },
  // ── Cuenta — sign out ──────────────────────────────────────────
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
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: 0.3,
  },
  errorText: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    color: colors.feedbackError,
    textAlign: 'center',
  },
  // ── Cuenta — delete account ────────────────────────────────────
  // The most destructive action: quiet, last, muted red. Reads as a tappable
  // button (bordered, faint red tint) — same silhouette as Cerrar sesión so
  // it doesn't float as bare text — but in muted red so it stays subordinate
  // to the magenta voice rather than competing with it.
  deleteRow: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.feedbackErrorHairline,
    backgroundColor: colors.feedbackErrorTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  deleteLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.feedbackError,
    letterSpacing: 0.3,
  },
  deletePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deletePendingLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
    opacity: 0.85,
  },
  // ── Footer ─────────────────────────────────────────────────────
  footer: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
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
