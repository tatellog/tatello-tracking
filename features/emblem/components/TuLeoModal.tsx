import { Feather } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import EmblemHalo from '@/assets/zodiac-art/emblem-halo-frame.svg'
import { useTransformProgress } from '@/features/emblem'
import {
  FRAMES_BY_SIGN,
  frameIndexFor,
} from '@/features/tabs/components/constellation/RevealedEmblem'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, radius, spacing, typography } from '@/theme'

export type LeoStar = { name: string; role: string }

type TuLeoModalProps = {
  visible: boolean
  onClose: () => void
  /** Clave del signo — para el emblema correcto (el MISMO león del Tab Hoy). */
  sign: ZodiacSign
  /** "Leo" — la etiqueta del signo. */
  signLabel: string
  /** Figure stars lit THIS MONTH (via «Entrené») + the figure total. */
  trained: number
  total: number
  /** Named figure stars already lit, in lighting order. */
  litStars: LeoStar[]
  /** The next star to light (named, anticipation — not a countdown). */
  nextStar: LeoStar | null
}

/**
 * "Tu Leo" — opened from the compact constellation hero on Hoy, over a blurred
 * Hoy (revelaciones language). PROGRESS-FOCUSED per the product critique: the
 * explicit % + count of the month's figure, the named stars lit so far, and
 * what's next — so it answers "¿cuánto llevo y qué sigue?", not just "mira el
 * arte". The gold lion is the representative art of your Leo; the data is the
 * monthly constellation. No actions; the only control is ✕.
 */
export function TuLeoModal({
  visible,
  onClose,
  sign,
  signLabel,
  trained,
  total,
  litStars,
  nextStar,
}: TuLeoModalProps) {
  const pct = total > 0 ? Math.round((trained / total) * 100) : 0
  // Halo brightens with progress — light grows as the figure fills.
  const haloOpacity = 0.3 + (pct / 100) * 0.6
  // EL MISMO león del Tab Hoy (el frame del % de revelado vigente), como
  // <Image> plano — no Skia, así no choca TextureViews con el del hero detrás.
  const { progress: emblemProgress } = useTransformProgress()
  const frames = FRAMES_BY_SIGN[sign]
  const lionFrame = frames[frameIndexFor(emblemProgress)] ?? frames[frames.length - 1]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Blurred, dimmed Hoy behind — same language as the revelations. */}
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.scrim} onPress={onClose}>
          {/* Inner press swallows taps so they don't close via the backdrop. */}
          <Pressable style={styles.card} onPress={() => {}}>
            {/* Atmósfera — glow radial oro→magenta detrás del emblema, para que
                emerja del cosmos y el card deje de ser un panel plano. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="emblemGlow" cx="50%" cy="32%" r="58%">
                    <Stop offset="0%" stopColor={colors.oro} stopOpacity={0.16} />
                    <Stop offset="42%" stopColor={colors.magenta} stopOpacity={0.1} />
                    <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#emblemGlow)" />
              </Svg>
            </View>
            <Pressable
              style={styles.close}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Feather name="x" size={20} color={colors.niebla} />
            </Pressable>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
              bounces={false}
            >
              <Text style={styles.eyebrow}>TU {signLabel.toUpperCase()}</Text>

              {/* El emblema REINA (el león del Tab Hoy, no el medallón viejo). */}
              <View style={styles.emblemWrap}>
                <EmblemHalo
                  width={216}
                  height={216}
                  style={[styles.halo, { opacity: haloOpacity }]}
                />
                <Image
                  source={lionFrame}
                  style={styles.lion}
                  resizeMode="contain"
                  accessibilityLabel={`Tu ${signLabel}. ${trained} de ${total} estrellas encendidas.`}
                />
              </View>

              {/* Titular CÁLIDO: el conteo de LUCES (no el %). El % vive chico
                  bajo la barra — el progreso se siente, no se examina. */}
              <Text style={styles.headline}>
                <Text style={styles.headlineNum}>{trained}</Text> de{' '}
                <Text style={styles.headlineNum}>{total}</Text> luces encendidas
              </Text>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
                {/* Spark clampeado para no salirse del track al 100 %. */}
                <Text style={[styles.barSpark, { left: `${Math.min(pct, 96)}%` }]}>✦</Text>
              </View>
              <Text style={styles.pctCaption}>{pct}% de tu figura este mes</Text>

              {litStars.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionEyebrow}>Lo que ya despertó</Text>
                  {litStars.map((s, idx) => (
                    <View
                      key={s.name}
                      style={[styles.starRow, idx > 0 ? styles.starRowDivider : null]}
                    >
                      <Text style={styles.starDot}>✦</Text>
                      <Text style={styles.starName}>{s.name}</Text>
                      <Text style={styles.starRole} numberOfLines={1}>
                        {s.role}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Anticipación, no countdown. Tres estados:
                  · queda una estrella con nombre → la nombramos (lo más rico)
                  · ya no quedan nombres pero la figura sigue → "se sigue tejiendo"
                    (las líneas que conectan no llevan nombre)
                  · figura completa → la luz extra de cada «Entrené». */}
              {nextStar ? (
                <Text style={styles.comingLine}>
                  La que sigue: <Text style={styles.comingEm}>{nextStar.name}</Text> —{' '}
                  {nextStar.role}.
                </Text>
              ) : trained < total ? (
                <Text style={styles.comingLine}>
                  Tu figura se sigue <Text style={styles.comingEm}>tejiendo</Text>.
                </Text>
              ) : (
                <Text style={styles.comingLine}>
                  Tu figura está <Text style={styles.comingEm}>completa</Text>. Cada «Entrené» suma
                  luz extra.
                </Text>
              )}

              <Text style={styles.rule}>Cada «Entrené» enciende una estrella de tu figura.</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 8, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
    backgroundColor: colors.bgCard2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    overflow: 'hidden',
  },
  scroll: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  close: { position: 'absolute', top: spacing.md, right: spacing.md, zIndex: 2 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.magenta,
  },
  // El emblema REINA — más grande, con aire debajo (es el héroe del card).
  emblemWrap: {
    width: 216,
    height: 216,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute' },
  // El león ocupa ~0.76 del halo (estética sello: respira dentro del aro).
  lion: { width: 164, height: 164 },
  // Titular cálido — el conteo de luces, no el %. Números en oro.
  headline: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    color: colors.bone,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  headlineNum: {
    fontFamily: typography.uiBold,
    color: colors.oroLeche,
    fontVariant: ['tabular-nums'],
  },
  // El % — subordinado, chiquito, bajo la barra (se siente, no se examina).
  pctCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  // Progress bar — flat views (rail + fill + spark), like the RevealBar.
  barTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.hairline,
    overflow: 'visible',
  },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.oro },
  barSpark: {
    position: 'absolute',
    top: -6,
    marginLeft: -7,
    fontSize: 13,
    color: colors.oroLeche,
    textShadowColor: colors.magentaGlow,
    textShadowRadius: 6,
  },
  section: { alignSelf: 'stretch', marginTop: spacing.xl },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: spacing.xs,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.s2,
  },
  // Divisor hairline oro entre filas — convierte la lista en "carta astral".
  starRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.oroHairlineSoft,
  },
  starDot: { fontSize: typography.sizes.smallLabel, color: colors.oro },
  starName: { fontFamily: typography.uiSemi, fontSize: typography.sizes.body, color: colors.leche },
  starRole: {
    flexShrink: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  comingLine: {
    alignSelf: 'stretch',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
    marginTop: spacing.lg,
  },
  comingEm: { fontFamily: typography.uiBold, color: colors.magenta },
  rule: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
