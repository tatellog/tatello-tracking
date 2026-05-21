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
import { useLatestPhotoSet } from '@/features/onboarding/photos/hooks/useLatestPhotoSet'
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

/** monthly_focus → settings display, mirrors the wizard's tu-intencion
 *  step. Each option carries the same poetic tagline the user saw
 *  there, so Settings reads as a continuation of the wizard's voice. */
const FOCUS_LABEL: Record<string, { label: string; tagline: string }> = {
  weight: { label: 'Bajar de peso', tagline: 'El cuerpo va a moverse' },
  energy: { label: 'Tener más energía', tagline: 'Saber de dónde sale tu fuerza' },
  sleep: { label: 'Dormir profundo', tagline: 'La noche se vuelve descanso' },
  food: { label: 'Comer con menos lucha', tagline: 'Que comer deje de pesar' },
  cycle: { label: 'Conocer mi ciclo', tagline: 'Tu cuerpo va a hablarte' },
  patterns: { label: 'Entender mis patrones', tagline: 'Stelar mapea lo que se repite' },
  mind: { label: 'Calmar la mente', tagline: 'Menos ruido por dentro' },
  other: { label: 'Otra cosa', tagline: 'La nombras tú' },
}

/*
 * Settings hub, in the app's celestial-editorial language. Cards:
 *   1. Mi perfil — identity (name + zodiac + age + altura + sexo).
 *      Tappable: opens /onboarding/about-you?source=settings.
 *   2. Tu intención — the monthly_focus the user declared in the
 *      wizard, surfaced as a separate tappable card (label + tagline)
 *      so it doesn't get buried with demographics. Tappable: opens
 *      /onboarding/tu-intencion?source=settings.
 *   3. Mis metas — macro targets (tappable, opens macro-targets).
 *   4. Track corporal — optional body-photo comparativa.
 *   5. Cómo te lee Stelar — what Stelar reads + data privacy promise.
 *   6. Cuenta — sign out.
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
  const { data: lastPhotoSetAt } = useLatestPhotoSet()

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

  const editIntention = () => {
    router.push('/onboarding/tu-intencion?source=settings')
  }

  const openBodyTrack = () => {
    router.push('/onboarding/photos/front?source=settings')
  }

  // Status line for the Track corporal card. We compute it from the
  // latest complete (4-angle) set so the card honestly says "X days
  // since your last comparativa" instead of pretending fresh state.
  const bodyTrackStatus = (() => {
    if (lastPhotoSetAt == null) return 'Aún sin foto · activar'
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
  const sexLabel = profile?.biological_sex ? (SEX_LABEL[profile.biological_sex] ?? '—') : '—'
  const intention = profile?.monthly_focus ? (FOCUS_LABEL[profile.monthly_focus] ?? null) : null

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
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Tu intención — the monthly_focus the user picked in
              tu-intencion, surfaced as its own tappable card with the
              same label + tagline pair the wizard used. Tapping
              re-opens /onboarding/tu-intencion?source=settings so the
              user can change it from here. ── */}
          <Animated.View entering={enter(150)}>
            <SectionHeader label="Tu intención" />
            <Pressable
              onPress={editIntention}
              accessibilityRole="button"
              accessibilityLabel="Editar tu intención"
            >
              <View style={styles.metaCard}>
                <View style={styles.metaMain}>
                  <Text style={styles.metaLabel}>{intention?.label ?? 'Aún sin definir'}</Text>
                  {intention ? (
                    <Text style={styles.metaValue}>{intention.tagline}</Text>
                  ) : (
                    <Text style={styles.metaValue}>Tocá para elegir un foco</Text>
                  )}
                </View>
                <Text style={styles.chevron}>›</Text>
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

          {/* ── Track corporal — the optional 4-angle body-photo
              comparativa. Out of the main onboarding flow on
              purpose; this is where users who want a physical-change
              record opt in. The status line uses the latest complete
              set so the card never lies about state. ── */}
          <Animated.View entering={enter(215)}>
            <SectionHeader label="Track corporal" />
            <Pressable
              onPress={openBodyTrack}
              accessibilityRole="button"
              accessibilityLabel="Abrir track corporal"
            >
              <View style={styles.metaCard}>
                <View style={styles.metaMain}>
                  <Text style={styles.metaLabel}>4 fotos cada 28 días</Text>
                  <Text style={styles.metaValue}>{bodyTrackStatus}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Cómo te lee Stelar — the intelligence, named and
              explained: what it reads, and that the data is yours. ── */}
          <Animated.View entering={enter(255)}>
            <SectionHeader label="Cómo te lee Stelar" />
            <View style={styles.stelarCard}>
              <Text style={styles.stelarBody}>
                Stelar lee{' '}
                <Text style={styles.stelarAccent}>
                  tu sueño, tus comidas, tu movimiento, tu ánimo
                </Text>
                . Encuentra tus patrones y escribe cada lectura de Tu Órbita.
              </Text>
              <View style={styles.cardDivider} />
              <Text style={styles.stelarBody}>
                <Text style={styles.stelarStrong}>Tus datos son tuyos.</Text> Viven en tu cuenta y
                nadie más los lee.
              </Text>
            </View>
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
    fontSize: 14,
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
  stelarStrong: {
    fontFamily: typography.displaySemi,
    color: colors.leche,
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
