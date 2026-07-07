import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState, type ReactNode } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import FoodVect from '@/assets/icons/food-vect.svg'
import NorthStarTint from '@/assets/icons/north-star-tint.svg'
import WaterTint from '@/assets/icons/water-tint.svg'
import { StelarLogo } from '@/components/brand/StelarLogo'
import { BetaFeedbackSheet } from '@/components/BetaFeedbackSheet'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StarLoader } from '@/components/StarLoader'
import { ChevronHint, usePressFeedback } from '@/components/ui/interaction'
import { track } from '@/lib/analytics'
import { useTransformProgress } from '@/features/emblem'
import { useMacroTargets } from '@/features/macros/hooks'
import { avatarUrl } from '@/features/profile/api'
import { useDeleteAccount, useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { SectionHeader, SkyBackground, TabHeader } from '@/features/tabs/components'
import { ZODIAC, ZodiacFigure, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { mlToLitresLabel, useWaterGoal } from '@/features/water/useWaterGoal'
import { useSession } from '@/hooks/useSession'
import { confirmBinary, useConfirm } from '@/lib/confirm'
import { clearVisitedDayOne } from '@/lib/onboardingFlags'
import { queryPersister } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { colors, radius, typography } from '@/theme'

const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

// Oro base de la familia de glifos ilustrados (el mismo que las placas
// horneadas energy/moon/water usan como `fill`). Los glifos `currentColor`
// (orbits, food) se tintan a ESTE valor —no a oroSoft, más oscuro— para que
// los cuatro iconos de "Tu camino" lean a una sola luminancia.
const ICON_GOLD = colors.oroVect

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
  const { goalMl } = useWaterGoal()
  // Ajuste: contar líquidos de las comidas como hidratación (ON por defecto).
  const updateProfile = useUpdateProfile()
  const countLiquids = profile?.count_liquids_from_meals !== false
  const toggleCountLiquids = (value: boolean) => {
    Haptics.selectionAsync().catch(() => {})
    updateProfile.mutate({ count_liquids_from_meals: value })
    track('settings_count_liquids_toggled', { enabled: value })
  }
  // % de transformación del emblema — la identidad CONSTRUIDA en Stelar, el
  // dato emocional de la card de perfil (no la ficha médica).
  const { progress: transformPct } = useTransformProgress()
  // El email de registro (auth) — no vive en profiles, sale de la sesión.
  const { session } = useSession()
  const email = session?.user?.email ?? null

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

  const openProfile = () => {
    router.push('/profile')
  }

  const editIntention = () => {
    router.push('/onboarding/intention?source=settings')
  }

  const editWater = () => {
    router.push('/water-goal')
  }

  const editNotifications = () => {
    router.push('/onboarding/notifications?source=settings')
  }

  const openPrivacy = () => {
    router.push('/privacy')
  }

  const openTerms = () => {
    router.push('/terms')
  }

  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null
  const intention = profile?.monthly_focus ? (FOCUS_LABEL[profile.monthly_focus] ?? null) : null
  // Secondary focuses (the picks AFTER the priority in the intention
  // wizard). Each one resolves to its label via FOCUS_LABEL; values we
  // don't know how to label (a hypothetical out-of-enum row) drop out.
  const secondaryIntentionLabels: string[] = (profile?.monthly_focus_secondary ?? [])
    .map((v) => FOCUS_LABEL[v]?.label)
    .filter((s): s is string => typeof s === 'string')

  // Celestial identity line — sign comes from the same source as the
  // Hoy-tab constellation, so the two screens agree.
  const zodiacSign = profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null
  const signLabel = zodiacSign ? ZODIAC[zodiacSign].label : null
  const identityLine = [signLabel, age != null ? `${age} años` : null].filter(Boolean).join('  ·  ')

  const avatarUri = profile?.avatar_path ? avatarUrl(profile.avatar_path) : null
  const initial = (profile?.display_name?.trim().charAt(0) || '✦').toUpperCase()

  // ── Tu camino — los valores de las sub-secciones (route config). ──
  // UNA fila para el objetivo (antes dos filas → el MISMO destino, que
  // desorientaba: "toqué Secundarios y caí en la pantalla completa"). El
  // valor compone prioridad + "· N más" (regla Apple: una fila, un destino).
  const objetivo = profileLoaded
    ? intention?.label
      ? secondaryIntentionLabels.length > 0
        ? `${intention.label}   ·   ${secondaryIntentionLabels.length} más`
        : intention.label
      : 'Aún sin definir'
    : 'Tu objetivo del mes'
  const nutricion = targetsLoading
    ? 'Cargando…'
    : targets
      ? `${targets.protein_g} g proteína   ·   ${targets.calories} kcal`
      : 'Aún sin definir'
  const agua = `${mlToLitresLabel(goalMl)} L diarios`

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
            <SectionHeader label="Tu identidad" />
            {profileError ? (
              <ProfileErrorCard onRetry={() => void refetchProfile()} />
            ) : profileLoading ? (
              <ProfileSkeleton />
            ) : (
              <IdentityCard
                name={profile?.display_name ?? 'Aún sin nombre'}
                signAge={identityLine}
                email={email}
                transformPct={transformPct}
                avatarUri={avatarUri}
                zodiacSign={zodiacSign}
                initial={initial}
                onPress={openProfile}
              />
            )}
          </Animated.View>

          {/* ── Tu plan — the three levers the user controls. One section
              header over three distinct cards. Each row shows a neutral
              skeleton while its query is in flight; the empty copy only
              appears once the query has resolved. ── */}
          {/* ── Tu camino — las preferencias de progreso como la CONFIGURACIÓN
              de una ruta, no settings técnicos. Cada fila: card compacta +
              glifo oro (familia ilustrada de Órbita) + valor + chevron + press
              feedback. Toca → pantalla. Los emoji 3D rompían la paleta; ahora
              cada glifo vive en un tile oro tenue (ver caminoIconBox). El
              "Objetivo principal" usa north-star (el peso es el norte) y su
              tile pesa un punto más (featured) para marcar jerarquía. ── */}
          <Animated.View entering={enter(150)}>
            <SectionHeader label="Tu camino" />
            <View style={styles.caminoList}>
              <CaminoRow
                icon={
                  <NorthStarTint
                    width={26}
                    height={26}
                    color={ICON_GOLD}
                    preserveAspectRatio="xMidYMid meet"
                  />
                }
                featured
                label="Tu objetivo"
                value={objetivo}
                onPress={editIntention}
              />
              <CaminoRow
                icon={
                  <FoodVect
                    width={32}
                    height={32}
                    color={ICON_GOLD}
                    preserveAspectRatio="xMidYMid meet"
                  />
                }
                label="Nutrición"
                value={nutricion}
                onPress={editTargets}
              />
              <CaminoRow
                icon={
                  <WaterTint
                    width={26}
                    height={26}
                    color={ICON_GOLD}
                    preserveAspectRatio="xMidYMid meet"
                  />
                }
                label="Agua"
                value={agua}
                onPress={editWater}
              />
            </View>
            <ToggleRow
              label="Contar líquidos de tus comidas"
              description="Stelar detecta bebidas en tus comidas y te propone sumarlas a tu agua del día."
              value={countLiquids}
              onValueChange={toggleCountLiquids}
            />
          </Animated.View>

          {/* ── Acerca de Stelar — DOCUMENTACIÓN del producto, no ajustes.
              Separada de Cuenta a propósito: la usuaria entiende que esto explica
              Stelar, no que configura nada. ── */}
          <Animated.View entering={enter(200)}>
            <SectionHeader label="Acerca de Stelar" />
            <View style={styles.caminoList}>
              <AboutRow
                label="Cómo funciona Stelar"
                caption="La idea detrás de tu cielo."
                onPress={() => router.push('/about/how-it-works')}
              />
              <AboutRow
                label="Cómo se construye tu Órbita"
                caption="Cómo se teje tu transformación."
                onPress={() => router.push('/about/orbit')}
              />
              <AboutRow
                label="Preguntas frecuentes"
                caption="Lo que más nos preguntan."
                onPress={() => router.push('/about/faq')}
              />
              <AboutRow
                label="Versión"
                caption="Stelar · v1.0.0"
                onPress={() => router.push('/about/changelog')}
              />
            </View>
          </Animated.View>

          {/* ── Cuenta — configuraciones reales en JERARQUÍA: primarias →
              secundarias → zona destructiva. Sin objetivos/macros (viven en "Tu
              camino") ni info de producto (qué lee Stelar vive en Privacidad).
              Así la usuaria encuentra ajustes reales rápido. ── */}
          <Animated.View entering={enter(260)}>
            <SectionHeader label="Cuenta" />

            <BetaFeedbackSheet
              visible={feedbackVisible}
              onClose={() => setFeedbackVisible(false)}
            />

            {/* Primarias — lo más a mano. */}
            <View style={styles.accountCard}>
              <AccountRow
                label="Notificaciones"
                tagline="Tú eliges cuándo aparecemos."
                onPress={editNotifications}
                accessibilityLabel="Editar notificaciones"
              />
              <View style={styles.accountDivider} />
              <AccountRow
                label="Privacidad"
                tagline="Tus datos son tuyos."
                onPress={openPrivacy}
                accessibilityLabel="Privacidad y tus datos"
              />
              <View style={styles.accountDivider} />
              <AccountRow
                label="Términos de uso"
                tagline="Qué es Stelar y qué no."
                onPress={openTerms}
                accessibilityLabel="Términos de uso"
              />
            </View>

            {/* Secundarias — soporte e info, más calladas. */}
            <Text style={styles.groupLabel}>Más</Text>
            <View style={styles.accountCard}>
              <AccountRow
                label="Feedback"
                tagline="Lo que sea, lo leemos."
                onPress={() => setFeedbackVisible(true)}
                accessibilityLabel="Danos tu feedback"
              />
            </View>

            {/* Destructivas — separadas del resto (hairline + aire), al fondo.
                Cerrar sesión arriba; Eliminar cuenta en COLOR ERROR, con doble
                confirmación (confirmBinary). */}
            <View style={styles.dangerZone}>
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

              <Pressable
                onPress={handleDeleteAccount}
                disabled={deleteAccount.isPending}
                accessibilityRole="button"
                accessibilityLabel="Eliminar mi cuenta"
                accessibilityState={{ busy: deleteAccount.isPending }}
                style={({ pressed }) => pressed && styles.rowPressed}
              >
                <View style={styles.deleteRow}>
                  {deleteAccount.isPending ? (
                    <View style={styles.deletePending}>
                      <StarLoader size={14} color={colors.feedbackError} />
                      <Text style={styles.deletePendingLabel}>Borrando tu cuenta...</Text>
                    </View>
                  ) : (
                    <Text style={styles.deleteLabel}>Eliminar mi cuenta</Text>
                  )}
                </View>
              </Pressable>
              {deleteAccount.error ? (
                <Text style={styles.errorText}>
                  No pudimos eliminar tu cuenta ahora. Toca para reintentar.
                </Text>
              ) : null}
            </View>

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
                  ✦ DEV · ver todas las constelaciones
                </Text>
              </Pressable>
            ) : null}
            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/dev-emblem-stages')}
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
                  ✦ DEV · Leo: todos los estados
                </Text>
              </Pressable>
            ) : null}
            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/dev-emblem-signs')}
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
                  ✦ DEV · signos por porcentaje
                </Text>
              </Pressable>
            ) : null}
            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/dev-rewards')}
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
                  ✦ DEV · sistema de recompensas
                </Text>
              </Pressable>
            ) : null}
            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/dev-revelations')}
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
                  ✦ DEV · revelaciones / patrones
                </Text>
              </Pressable>
            ) : null}
            {profile?.is_dev ? (
              <Pressable
                onPress={() => router.push('/dev-notifications')}
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
                  ✦ DEV · probar notificaciones
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>

          {/* Marca al cierre de Ajustes (patrón premium: lockup + versión al
              fondo). El wordmark va como brand asset, no como fuente. */}
          <Animated.View entering={enter(300)} style={styles.brandLockup}>
            <StelarLogo variant="horizontal" size={44} />
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

/* "Tu identidad" — la card EMOCIONAL del perfil: no una ficha médica (sin
 * altura ni sexo), sino "este es mi cielo": nombre + signo·edad + el % de
 * transformación construido en Stelar. Toca → pantalla Perfil. Press: escala
 * 0.98 (usePressFeedback) + glow magenta muy sutil + chevron visible. */
function IdentityCard({
  name,
  signAge,
  email,
  transformPct,
  avatarUri,
  zodiacSign,
  initial,
  onPress,
}: {
  name: string
  signAge: string
  email: string | null
  transformPct: number
  avatarUri: string | null
  zodiacSign: ZodiacSign | null
  initial: string
  onPress: () => void
}) {
  const press = usePressFeedback()
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Ver mi perfil"
      accessibilityHint="Abre tu perfil"
    >
      <Animated.View style={[styles.identityCard, press.animatedStyle]}>
        <View style={styles.identityRow}>
          <View style={styles.identityAvatar}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.identityAvatarImg} />
            ) : zodiacSign ? (
              <ZodiacFigure sign={zodiacSign} size={38} color={colors.magenta} />
            ) : (
              <Text style={styles.identityInitial}>{initial}</Text>
            )}
          </View>
          <View style={styles.identityTextCol}>
            <Text style={styles.identityName} numberOfLines={1}>
              {name}
            </Text>
            {signAge ? <Text style={styles.identitySignAge}>{signAge}</Text> : null}
            {/* Bajo el 8% el número trabaja en contra ("1%" = "saqué 1 de 100
                en el examen", target-user): cualitativo hasta que el % cuente
                una historia. "Constelación", no "transformación": junto al
                avatar se leía como transformación corporal, y el glosario
                visible habla de constelación/cielo (voice-and-copy jul 2026).
                Mismo copy que Perfil y mismo umbral que Órbita Mes. */}
            {transformPct > 0 ? (
              <Text style={styles.identityTransform}>
                {transformPct < 8
                  ? 'Tu constelación apenas empieza a revelarse'
                  : `${transformPct}% de tu constelación revelada`}
              </Text>
            ) : null}
            {email ? (
              <Text style={styles.identityEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.identityCta}>
          <Text style={styles.identityCtaText}>Ver perfil</Text>
          <ChevronHint direction="right" size={15} color={colors.magenta} />
        </View>
      </Animated.View>
    </Pressable>
  )
}

/* A "Tu plan" item — its own bordered card: a bold label, a sub-value
 * (a plain string via `value`, or a rich node via `valueNode` for the
 * macros / skeleton lines) and a chevron. Three of these stack under a
 * single section header. `last` drops the bottom margin so the section
 * doesn't over-pad before the next header. */
/* Una fila de "Tu camino" — card compacta: glifo oro en tile + etiqueta +
 * valor + chevron, con press feedback (escala). Toca → pantalla específica
 * (sin formularios inline). Se siente como configurar una ruta, no settings
 * técnicos. `icon` es el glifo ya renderizado (familia oro de Órbita); el
 * tile (caminoIconBox) lo ancla para que 4 siluetas irregulares no floten ni
 * salten de altura. `featured` (solo "Objetivo principal") sube un punto el
 * fill del tile para marcar jerarquía sin meter otro color. */
function CaminoRow({
  icon,
  featured,
  label,
  value,
  onPress,
}: {
  icon: ReactNode
  featured?: boolean
  label: string
  value: string
  onPress: () => void
}) {
  const press = usePressFeedback()
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Toca para editar.`}
    >
      <Animated.View style={[styles.caminoCard, press.animatedStyle]}>
        {/* El glifo es decorativo — el accessibilityLabel de la fila ya lo
            cubre, así que se oculta de VoiceOver para no duplicar lectura. */}
        <View
          style={[styles.caminoIconBox, featured && styles.caminoIconBoxFeatured]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {icon}
        </View>
        <View style={styles.caminoText}>
          <Text style={styles.caminoLabel}>{label}</Text>
          <Text style={styles.caminoValue} numberOfLines={2}>
            {value}
          </Text>
        </View>
        <ChevronHint direction="right" size={16} color={colors.niebla} />
      </Animated.View>
    </Pressable>
  )
}

/* Una fila con interruptor — para ajustes booleanos (ON/OFF). Misma card
 * compacta que CaminoRow, pero con un Switch en lugar de chevron: la usuaria
 * cambia el valor aquí mismo, sin navegar. El Switch nativo ya es accesible
 * (role + estado), así que la fila no lo duplica. */
function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string
  description: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  return (
    <View style={styles.toggleCard}>
      <View style={styles.toggleText}>
        <Text style={styles.caminoLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.bgCard2, true: colors.magenta }}
        thumbColor={colors.leche}
        ios_backgroundColor={colors.bgCard2}
        accessibilityLabel={label}
      />
    </View>
  )
}

/* Una fila de "Acerca de Stelar" — card compacta de DOCUMENTACIÓN (sin emoji):
 * etiqueta + descripción + chevron + press feedback. Toca → pantalla de doc.
 * Misma forma que CaminoRow para que la sección se sienta hermana, pero su
 * lenguaje (descripción, no valor configurable) dice "esto explica, no ajusta". */
function AboutRow({
  label,
  caption,
  onPress,
}: {
  label: string
  caption: string
  onPress: () => void
}) {
  const press = usePressFeedback()
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${caption}`}
    >
      <Animated.View style={[styles.caminoCard, press.animatedStyle]}>
        <View style={styles.caminoText}>
          <Text style={styles.caminoLabel}>{label}</Text>
          <Text style={styles.caminoValue} numberOfLines={1}>
            {caption}
          </Text>
        </View>
        <ChevronHint direction="right" size={16} color={colors.niebla} />
      </Animated.View>
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
  // ── "Tu identidad" — la card emocional (dark luxury, glow magenta sutil) ──
  identityCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.magentaTint2,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  identityAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityAvatarImg: {
    width: 60,
    height: 60,
  },
  identityInitial: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    color: colors.magenta,
  },
  identityTextCol: {
    flex: 1,
    minWidth: 0,
  },
  // Nombre — tipografía editorial, grande, la heroína de la card.
  identityName: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    letterSpacing: -0.8,
    color: colors.leche,
  },
  identitySignAge: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  // El dato emocional: la identidad CONSTRUIDA en Stelar.
  identityTransform: {
    marginTop: 5,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.magenta,
  },
  // Email de registro (auth) — dato de cuenta, callado.
  identityEmail: {
    marginTop: 6,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  identityCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  identityCtaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.magenta,
  },
  // ── "Tu camino" — cards compactas de configuración de ruta ──
  caminoList: {
    gap: 10,
  },
  caminoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // Tile oro tenue que ancla el glifo — un squircle (no círculo, que leería
  // como avatar/estado) con fill oro 8% + hairline oro suave. Sin él, una
  // placa oro suelta flota sobre bgCard y cada silueta irregular salta de
  // altura óptica. 40×40 con glifo de 32 (las placas tienen aire interno en
  // su viewBox ~820, así que se renderizan más chicas que su tamaño nominal).
  caminoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oroTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
  },
  // "Objetivo principal" — el norte. Su tile pesa un punto más (fill ~0.14 +
  // hairline oro pleno) para marcar jerarquía por MODULACIÓN de opacidad, no
  // por cambio de color (magenta queda reservado a identidad/CTA).
  caminoIconBoxFeatured: {
    backgroundColor: 'rgba(217, 174, 111, 0.14)',
    borderColor: colors.oroHairline,
  },
  caminoText: {
    flex: 1,
    minWidth: 0,
  },
  caminoLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.2,
    color: colors.leche,
  },
  caminoValue: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Fila de interruptor — hermana de caminoCard, separada del list con aire.
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleText: {
    flex: 1,
    minWidth: 0,
  },
  toggleDesc: {
    marginTop: 2,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
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
    fontSize: typography.sizes.bodyLarge,
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
    fontSize: typography.sizes.ui,
    color: colors.niebla,
  },
  rowValue: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
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
    fontSize: typography.sizes.title,
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
    fontSize: typography.sizes.label,
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
  // Sub-encabezado de grupo (secundarias) — separa jerarquía sin gritar.
  groupLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bruma,
    marginBottom: 8,
  },
  // Zona destructiva — separada del resto con un hairline + aire arriba, así
  // "Cerrar sesión" y "Eliminar cuenta" no se confunden con la configuración.
  dangerZone: {
    marginTop: 10,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
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
    fontSize: typography.sizes.title,
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
  // Ghost PILL — the shape is the signal: cards are never pill-shaped, so a
  // pill can't be mistaken for a container. Transparent fill + hairline
  // border reads as a low-stakes action, subordinate to the magenta voice.
  signOut: {
    marginTop: 4,
    backgroundColor: 'transparent',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 15,
    paddingHorizontal: 24,
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
    fontSize: typography.sizes.label,
    color: colors.feedbackError,
    textAlign: 'center',
  },
  // ── Cuenta — delete account ────────────────────────────────────
  // The most destructive action: quiet, last, muted red. Reads as a tappable
  // button (bordered, faint red tint) — same silhouette as Cerrar sesión so
  // it doesn't float as bare text — but in muted red so it stays subordinate
  // to the magenta voice rather than competing with it.
  // Destructive PILL — same pill silhouette as Cerrar sesión so the two
  // account-zone actions read as a matched pair of buttons (not cards), but
  // in muted red so it stays subordinate to the magenta voice.
  deleteRow: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.feedbackErrorHairline,
    backgroundColor: colors.feedbackErrorTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
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
  brandLockup: {
    alignItems: 'center',
    marginTop: 40,
  },
  footer: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
    textAlign: 'center',
    // Cerca del lockup para que marca + frase lean como UN cierre, no como
    // dos elementos sueltos.
    marginTop: 16,
  },
  footerEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
})
