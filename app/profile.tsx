import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { StarLoader } from '@/components/StarLoader'
import { useAlmaCelesteHeadline } from '@/features/emblem'
import { avatarUrl } from '@/features/profile/api'
import { useProfile, useUploadAvatar } from '@/features/profile/hooks'
import { SkyBackground } from '@/features/tabs/components'
import { ZODIAC, ZodiacFigure, zodiacFromDate } from '@/features/tabs/zodiac'
import { GLYPH_BY_SIGN } from '@/features/tabs/zodiac/glyphs'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, radius, typography } from '@/theme'

const SEX_LABEL: Record<string, string> = {
  female: 'Femenino',
  male: 'Masculino',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatBirthdate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return `${d} ${MESES[(m ?? 1) - 1] ?? ''} ${y}`
}

function calculateAge(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const today = new Date()
  let age = today.getFullYear() - y
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)
  if (beforeBirthday) age -= 1
  return age
}

const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

const AVATAR = 88
const ORBIT = 124 // aro orbital con aire alrededor de la foto

export default function ProfileScreen() {
  return (
    <ErrorBoundary screen="perfil">
      <ProfileBody />
    </ErrorBoundary>
  )
}

function ProfileBody() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const uploadAvatar = useUploadAvatar()

  const sign = profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null
  // Headline unificado por fase (emblema mientras la figura se forma → Alma
  // Celeste al completarla). Sin signo aún → 'leo' (no se muestra igual).
  const { pct: transformPct } = useAlmaCelesteHeadline(sign ?? 'leo')
  const signLabel = sign ? ZODIAC[sign].label : null
  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null
  const kicker = [signLabel, age != null ? `${age} años` : null].filter(Boolean).join(' · ')
  const avatarUri = profile?.avatar_path ? avatarUrl(profile.avatar_path) : null
  const initial = (profile?.display_name?.trim().charAt(0) || '✦').toUpperCase()
  const SignGlyph = sign ? GLYPH_BY_SIGN[sign] : null

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

  const editAboutYou = () => router.push('/onboarding/about-you?source=settings')
  const editBody = () => router.push('/onboarding/body-base?source=settings')

  return (
    <View style={styles.screen}>
      <SkyBackground />
      {/* El cielo de la usuaria: su propia constelación, tenue, al fondo —
          convierte el vacío en atmósfera personal ("este es mi cielo"). */}
      {sign ? <ConstellationField sign={sign} /> : null}

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title}>Perfil</Text>
          <View style={styles.back} />
        </View>

        {/* Contenido centrado verticalmente: identidad + datos flotan en el
            centro del cielo, el vacío se reparte arriba y abajo (respira). */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(40)} style={styles.identity}>
            {/* Avatar como "tu estrella": foto + aro orbital oro + halo doble
                + badge de cámara (la foto se cambia tocando aquí). */}
            <View style={styles.avatarWrap}>
              <View style={styles.haloOuter} pointerEvents="none" />
              <View style={styles.orbit} pointerEvents="none">
                <AvatarOrbit />
              </View>
              <Pressable
                onPress={pickAvatar}
                disabled={uploadAvatar.isPending}
                accessibilityRole="button"
                accessibilityLabel="Cambiar foto de perfil"
                style={styles.avatar}
              >
                {uploadAvatar.isPending ? (
                  <StarLoader size={18} color={colors.magenta} />
                ) : avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : sign ? (
                  <ZodiacFigure sign={sign} size={46} color={colors.magenta} />
                ) : (
                  <Text style={styles.avatarInitial}>{initial}</Text>
                )}
                <View style={styles.cameraBadge}>
                  <Feather name="camera" size={11} color={colors.leche} />
                </View>
              </Pressable>
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {profile?.display_name ?? 'Aún sin nombre'}
            </Text>

            {kicker ? (
              <View style={styles.kickerRow}>
                {SignGlyph ? <SignGlyph width={13} height={13} color={colors.oro} /> : null}
                <Text style={styles.kicker}>{kicker}</Text>
              </View>
            ) : null}

            {transformPct > 0 ? (
              <Text style={styles.transform}>
                <Text style={styles.transformNum}>{transformPct}%</Text> del Alma Celeste
              </Text>
            ) : null}
          </Animated.View>

          {/* Tu carta — identidad (de la fecha nace el signo). */}
          <Animated.View entering={enter(110)}>
            <Text style={styles.groupLabel}>Tu carta</Text>
            <View style={styles.card}>
              <Row
                label="Nombre"
                value={profile?.display_name ?? 'Sin definir'}
                onPress={editAboutYou}
              />
              <Row
                label="Fecha de nacimiento"
                value={
                  profile?.date_of_birth ? formatBirthdate(profile.date_of_birth) : 'Sin definir'
                }
                onPress={editAboutYou}
                last
              />
            </View>
          </Animated.View>

          {/* Tu cuerpo — datos del motor de cálculo. */}
          <Animated.View entering={enter(160)}>
            <Text style={styles.groupLabel}>Tu cuerpo</Text>
            <View style={styles.card}>
              <Row
                label="Altura"
                value={profile?.height_cm ? `${profile.height_cm} cm` : 'Sin definir'}
                onPress={editBody}
              />
              <Row
                label="Sexo biológico"
                value={
                  profile?.biological_sex
                    ? (SEX_LABEL[profile.biological_sex] ?? 'Sin definir')
                    : 'Sin definir'
                }
                onPress={editBody}
                last
              />
            </View>
          </Animated.View>

          {uploadAvatar.isError ? (
            <Pressable onPress={pickAvatar} accessibilityRole="button">
              <Text style={styles.error}>No pudimos cambiar tu foto. Toca para reintentar.</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/* El aro orbital del avatar — anillo oro + ticks cardinales + una estrella viva
 * asimétrica. Estático, tintable, sin Skia. Va detrás/alrededor de la foto. */
function AvatarOrbit() {
  return (
    <Svg width={ORBIT} height={ORBIT} viewBox="0 0 120 120" fill="none">
      <Circle cx={60} cy={60} r={56} stroke={colors.oro} strokeWidth={1} opacity={0.5} />
      <Path
        d="M60 2 V7 M60 113 V118 M2 60 H7 M113 60 H118"
        stroke={colors.oro}
        strokeWidth={0.8}
        opacity={0.4}
        strokeLinecap="round"
      />
      {/* la estrella viva + su halo (sin blur: un círculo grande tenue) */}
      <Circle cx={98} cy={22} r={5} fill={colors.oroLight} opacity={0.18} />
      <Circle cx={98} cy={22} r={2.4} fill={colors.oroLight} opacity={0.95} />
    </Svg>
  )
}

/* La constelación del signo, tenue, anclada al tercio inferior — el "cielo de
 * la usuaria". Se deriva de las coordenadas reales de ZODIAC[sign]. */
function ConstellationField({ sign }: { sign: ZodiacSign }) {
  const { width } = useWindowDimensions()
  const W = Math.round(width * 1.25)
  const H = Math.round(W * 0.66)
  const def = ZODIAC[sign]
  return (
    <View style={styles.constellation} pointerEvents="none">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {def.lines.map(([a, b], i) => {
          const sa = def.stars[a]
          const sb = def.stars[b]
          if (!sa || !sb) return null
          return (
            <Line
              key={i}
              x1={sa.x * W}
              y1={sa.y * H}
              x2={sb.x * W}
              y2={sb.y * H}
              stroke={colors.oro}
              strokeWidth={0.7}
              opacity={0.45}
              strokeLinecap="round"
            />
          )
        })}
        {def.stars.map((s, i) => (
          <Circle
            key={i}
            cx={s.x * W}
            cy={s.y * H}
            r={Math.max(0.8, 2.9 - s.mag * 0.5)}
            fill={colors.oroLight}
            opacity={Math.max(0.4, 1 - s.mag * 0.15)}
          />
        ))}
      </Svg>
    </View>
  )
}

function Row({
  label,
  value,
  onPress,
  last,
}: {
  label: string
  value: string
  onPress: () => void
  last?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Toca para editar.`}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
        <Feather name="chevron-right" size={19} color={colors.niebla} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  // Constelación del signo: tenue, abajo, desbordando a la derecha (asimetría).
  constellation: {
    position: 'absolute',
    bottom: -10,
    right: -48,
    opacity: 0.16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    letterSpacing: 0.2,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // ── Identidad ──
  identity: {
    alignItems: 'center',
    marginBottom: 34,
  },
  avatarWrap: {
    width: ORBIT,
    height: ORBIT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  // Halo doble: wash dorado amplio (memoria) detrás del glow magenta del avatar.
  haloOuter: {
    position: 'absolute',
    width: ORBIT,
    height: ORBIT,
    borderRadius: ORBIT / 2,
    backgroundColor: colors.oroTint,
  },
  orbit: { position: 'absolute' },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magentaGlow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarImg: { width: AVATAR, height: AVATAR },
  avatarInitial: {
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    color: colors.magenta,
  },
  // Badge de cámara — afordance de "cambiar foto" sobre el avatar.
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ruby — héroe tipográfico.
  name: {
    fontFamily: typography.displayHeavy,
    fontSize: 32,
    letterSpacing: -1,
    color: colors.leche,
    textAlign: 'center',
  },
  // Kicker editorial: glifo oro + "LEO · 29 años" en mayúsculas con tracking.
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  kicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  // El dato vivo CONSTRUIDO en Stelar — magenta (reservado a esto).
  transform: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  transformNum: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
  // ── Cards de datos ──
  groupLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 18,
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 22,
  },
  // Divisor "carta astral" en oro, no gris. Inset para que cada dato respire
  // como su propia zona, no como dos renglones pegados.
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.oroHairlineSoft,
  },
  rowPressed: { opacity: 0.55 },
  // Etiqueta legible (bone), valor como lo más brillante (leche, semibold).
  // Antes la etiqueta iba en niebla ("jerarquía invertida") y se perdía sobre
  // el cielo oscuro — el dueño pidió que se leyera bien.
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  rowRight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    flexShrink: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  error: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.feedbackError,
    textAlign: 'center',
  },
})
