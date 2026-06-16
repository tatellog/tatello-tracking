import { Feather } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import EmblemHalo from '@/assets/zodiac-art/emblem-halo-frame.svg'
import LeoConstellationOverlay from '@/assets/zodiac-art/leo-constellation-overlay.svg'
import LeoMapDivider from '@/assets/zodiac-art/leo-map-divider.svg'
import LeoEmblemArt from '@/assets/zodiac-art/leo-emblem.svg'
import { colors, radius, spacing, typography } from '@/theme'

import { EMBLEM_STAGES, type EmblemStage, withSign } from '../logic'

export type LeoStar = { name: string; role: string }

type TuLeoModalProps = {
  visible: boolean
  onClose: () => void
  /** "Leo" — the sign label. */
  signLabel: string
  /** Current emblem stage (drives the hero line + the journey marker). */
  stage: EmblemStage
  /** Emblem % revealed — kept as a quiet reference next to the stage label. */
  progress: number
  /** Named figure stars that movement has lit, in lighting order. */
  litStars: LeoStar[]
  /** The next figure star to light (named, no countdown), if any. */
  nextStar: LeoStar | null
}

// The hero is a square: the gold lion (emblem) + the magenta constellation
// overlaid on its anatomy share viewBox 1024² so they stack pixel-perfect at
// the same size. The halo frame sits behind, slightly larger.
const HERO_SIZE = 244
const HALO_SIZE = 300

// One-line qualitative gloss per emblem stage (from EMBLEM_STAGES' anatomical
// reveal notes) — anticipation by quality, never %/locks.
const STAGE_GLOSS: Record<string, string> = {
  despierta: 'los primeros trazos',
  forma: 'su forma se dibuja',
  revela: 'su melena aparece',
  casi: 'empieza a resplandecer',
  completo: 'oro pleno',
}

/**
 * "Tu Leo" — the celestial reliquary behind the hero constellation. Opened by
 * tapping the figure on Hoy, over a blurred Hoy (like PatternReveal). A calm
 * read of your Leo: the HERO (the gold lion with Leo's asterism lit in magenta
 * over its anatomy — emblem + constellation as one rich image, like a luxury
 * star chart), its transformation stage, the JOURNEY of stages (qualitative,
 * no goal), and the map of figure stars your movement has lit. No countdowns,
 * no actions — only ✕. A space to look, not to do.
 */
export function TuLeoModal({
  visible,
  onClose,
  signLabel,
  stage,
  progress,
  litStars,
  nextStar,
}: TuLeoModalProps) {
  const heroLine = withSign(stage.message, signLabel)
  const stageIndex = Math.max(
    0,
    EMBLEM_STAGES.findIndex((s) => s.key === stage.key),
  )
  // Halo brightens with the stage (brasa → pleno) — light grows with the arc.
  const haloOpacity = 0.35 + (stageIndex / (EMBLEM_STAGES.length - 1)) * 0.55

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Blurred, dimmed Hoy behind — the reliquary floats over the cosmos. */}
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

              {/* HERO · the gold lion with Leo's constellation lit in magenta
                  over its anatomy. Halo behind (stage-bright), then the emblem,
                  then the constellation overlay — both at HERO_SIZE so the
                  stars fall on chest / mane / haunches. One rich image. */}
              <View style={styles.heroWrap}>
                <EmblemHalo
                  width={HALO_SIZE}
                  height={HALO_SIZE}
                  style={[styles.halo, { opacity: haloOpacity }]}
                />
                <LeoEmblemArt width={HERO_SIZE} height={HERO_SIZE} />
                <LeoConstellationOverlay
                  width={HERO_SIZE}
                  height={HERO_SIZE}
                  color={colors.magenta}
                  style={styles.overlay}
                />
              </View>

              {/* Stage as hero — coach voice. % kept small, as reference. */}
              <Text style={styles.heroLine}>{heroLine}</Text>
              <Text style={styles.stageMeta}>
                {stage.label} · {progress}% revelado
              </Text>

              {/* The journey of 5 stages — where you are, qualitatively. No
                  bar, no locks: lived stages glow oro, those ahead are named
                  in ember (anticipation, never a countdown). */}
              <View style={styles.section}>
                <Text style={styles.sectionEyebrow}>El viaje de tu {signLabel}</Text>
                {EMBLEM_STAGES.map((s, i) => {
                  const reached = i <= stageIndex
                  const current = i === stageIndex
                  return (
                    <View key={s.key} style={styles.journeyRow}>
                      <Text style={[styles.journeyDot, reached && styles.journeyDotOn]}>
                        {reached ? '✦' : '·'}
                      </Text>
                      <Text style={[styles.journeyLabel, !reached && styles.journeyLabelFuture]}>
                        {s.label}
                      </Text>
                      <Text style={styles.journeyGloss} numberOfLines={1}>
                        {current ? 'aquí vas' : STAGE_GLOSS[s.key]}
                      </Text>
                    </View>
                  )
                })}
              </View>

              {litStars.length > 0 ? (
                <View style={styles.section}>
                  <LeoMapDivider width={260} height={15} style={styles.divider} />
                  {/* Honest source: the figure's stars light from "Entrené"
                      (movement), distinct from the emblem's all-habit reveal. */}
                  <Text style={styles.sectionEyebrow}>Lo que tu movimiento ha encendido</Text>
                  {litStars.map((s) => (
                    <View key={s.name} style={styles.starRow}>
                      <Text style={styles.starDot}>✦</Text>
                      <Text style={styles.starName}>{s.name}</Text>
                      <Text style={styles.starRole} numberOfLines={1}>
                        {s.role}
                      </Text>
                    </View>
                  ))}
                  {nextStar ? (
                    <Text style={styles.comingLine}>
                      La que sigue: <Text style={styles.comingEm}>{nextStar.name}</Text> —{' '}
                      {nextStar.role}.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.guarantee}>Tu transformación nunca retrocede.</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  close: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.magenta,
  },
  // ── Hero (lion + constellation overlay) ───────────────────────────
  heroWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  // The overlay shares the emblem's viewBox + size, so absolute-centering it
  // over the emblem lands every star on the lion's anatomy.
  overlay: {
    position: 'absolute',
    width: HERO_SIZE,
    height: HERO_SIZE,
  },
  heroLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: typography.sizes.headingLg * typography.lineHeight.statement,
    color: colors.leche,
    textAlign: 'center',
  },
  stageMeta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    marginTop: spacing.sm,
    letterSpacing: 0.3,
  },
  section: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseTight,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: spacing.xs,
  },
  // ── Journey rows ──────────────────────────────────────────────────
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  journeyDot: {
    width: 14,
    textAlign: 'center',
    fontSize: typography.sizes.smallLabel,
    color: colors.bruma,
  },
  journeyDotOn: {
    color: colors.oro,
  },
  journeyLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  journeyLabelFuture: {
    color: colors.niebla,
  },
  journeyGloss: {
    flexShrink: 1,
    marginLeft: 'auto',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  divider: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
    opacity: 0.9,
  },
  // ── Figure star list ──────────────────────────────────────────────
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Oro dot (not magenta) — gold is earned progress; magenta stays reserved
  // for "la que sigue".
  starDot: {
    fontSize: typography.sizes.smallLabel,
    color: colors.oro,
  },
  starName: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  starRole: {
    flexShrink: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  comingLine: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: typography.sizes.body * typography.lineHeight.body,
    color: colors.bone,
    marginTop: spacing.xs,
  },
  comingEm: {
    fontFamily: typography.uiBold,
    color: colors.magenta,
  },
  guarantee: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
})
