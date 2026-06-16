import { Feather } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

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

              <View style={styles.emblemWrap}>
                <EmblemHalo
                  width={200}
                  height={200}
                  style={[styles.halo, { opacity: haloOpacity }]}
                />
                {/* El león del Tab Hoy (frame de revelado), no el medallón
                    ornamentado viejo. */}
                <Image source={lionFrame} style={styles.lion} resizeMode="contain" />
              </View>

              {/* Explicit progress — the number, big. */}
              <Text style={styles.pct}>
                {pct}
                <Text style={styles.pctSign}>%</Text>
              </Text>
              <Text style={styles.pctCaption}>de tu figura este mes</Text>

              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
                <Text style={[styles.barSpark, { left: `${pct}%` }]}>✦</Text>
              </View>
              <Text style={styles.countLine}>
                {trained} de {total} luces encendidas
              </Text>

              {litStars.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionEyebrow}>Lo que ya despertó</Text>
                  {litStars.map((s) => (
                    <View key={s.name} style={styles.starRow}>
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
  emblemWrap: {
    width: 200,
    height: 200,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute' },
  // El león ocupa ~0.72 del halo (estética sello: respira dentro del aro).
  lion: { width: 150, height: 150 },
  pct: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.streakNum,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  pctSign: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.heading,
    color: colors.niebla,
  },
  pctCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
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
  countLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginTop: spacing.sm,
  },
  section: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.sm },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: spacing.xs,
  },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
