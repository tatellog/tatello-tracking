import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, shadows, typography } from '@/theme'

import { StarLoader } from './StarLoader'

export type CtaVariant = 'primary' | 'ghost' | 'soft' | 'destructive'

/** Label casing. Default `uppercase` preserves the wizard/installer
 *  CTA language used everywhere else in the app. `none` opts a single
 *  CTA into a warmer sentence-case voice (e.g. the manifesto step). */
export type CtaTransform = 'uppercase' | 'none'

type Props = {
  label: string
  onPress: () => void
  variant?: CtaVariant
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  marginTop?: number
  marginBottom?: number
  accessibilityLabel?: string
  /** Pill shape (border-radius 100) instead of the default soft rect.
   *  Used by the new identidad / cuerpo onboarding screens whose
   *  language is rounder than the rest of the wizard. */
  pill?: boolean
  /** Label casing. Defaults to `uppercase` (unchanged for every
   *  existing CTA). Pass `none` for a sentence-case, calmer label. */
  transform?: CtaTransform
}

export function PrimaryCta({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel = 'Guardando…',
  marginTop = 0,
  marginBottom = 0,
  accessibilityLabel,
  pill = false,
  transform = 'uppercase',
}: Props) {
  const inactive = disabled || loading
  const isGhost = variant === 'ghost'
  const isSoft = variant === 'soft'
  const isDestructive = variant === 'destructive'
  const isPlain = transform === 'none'
  // Activation glow — when a SOFT cta is READY (enabled, not loading),
  // its border picks up the SAME magentaHot halo language as the
  // about-you hairline that "lights up" when a field fills, and its
  // translucent fill warms one step (magentaTint). Default-inocuo:
  // ONLY the soft variant in its enabled state is touched — primary /
  // ghost / destructive, and a disabled (waiting) soft cta, are all
  // exactly as before. welcome / what-it-does / attribution use soft and so
  // simply gain the same coherent ready-glow once their step validates.
  const softReady = isSoft && !inactive

  const handlePress = () => {
    if (inactive) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    onPress()
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[
        styles.btn,
        isGhost && styles.btnGhost,
        isSoft && styles.btnSoft,
        softReady && styles.btnSoftReady,
        isSoft && inactive && styles.btnSoftDisabled,
        isDestructive && styles.btnDestructive,
        inactive && !isGhost && !isSoft && styles.btnDisabled,
        pill && styles.btnPill,
        { marginTop, marginBottom },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <StarLoader
            size={18}
            color={isGhost ? colors.leche : isSoft ? colors.magenta : '#FFFFFF'}
          />
          <Text
            style={[
              styles.label,
              isGhost && styles.labelGhost,
              isSoft && styles.labelSoft,
              isPlain && styles.labelPlain,
            ]}
          >
            {loadingLabel}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.label,
            isGhost && styles.labelGhost,
            isSoft && styles.labelSoft,
            isPlain && styles.labelPlain,
            inactive && !isGhost && !isSoft && styles.labelDisabled,
            isSoft && inactive && styles.labelSoftDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: 4,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMagenta,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.bruma,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Soft — keeps the magenta identity but calms it: tinted fill +
  // magenta border + a gentle (not saturated) glow. Reads as an
  // invitation, not a demand; matches the active-state language of
  // the TodayWorkoutButton pill.
  btnSoft: {
    backgroundColor: 'rgba(233,30,99,0.12)',
    borderWidth: 1.5,
    borderColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  // Soft + READY (enabled) — the activation state. Shares the about-you
  // hairline's "constellation lights up" language: a tighter magentaHot
  // halo (radius ~6, opacity ~0.4) reads as ignition rather than the
  // resting magenta drop-shadow, and the fill warms one step to
  // magentaTint. Layered AFTER btnSoft so these props win when ready.
  // iOS-first (shadowColor/Radius glow); Android keeps elevation 3 from
  // btnSoft and degrades to the flat tinted pill — no break.
  btnSoftReady: {
    backgroundColor: colors.magentaTint,
    shadowColor: colors.magentaHot,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  // Destructive — same filled-CTA geometry, swapped to the warning
  // red with a matching red glow. For delete / sign-out confirms.
  btnDestructive: {
    backgroundColor: colors.feedbackError,
    shadowColor: colors.feedbackError,
  },
  btnDisabled: {
    backgroundColor: colors.bgCard2,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Soft + DISABLED (waiting) — the soft cta must look clearly NOT-yet
  // tappable, otherwise the magenta border/label read as enabled and the
  // user taps a dead button (it only ignites once the step validates).
  // Muted border + no fill + no glow; the label dims to niebla.
  btnSoftDisabled: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.12)',
    shadowOpacity: 0,
    elevation: 0,
  },
  // Pill — full rounded shape.
  btnPill: {
    borderRadius: 100,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
  },
  labelGhost: {
    color: colors.leche,
    textTransform: 'none',
    letterSpacing: 0,
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
  },
  labelSoft: {
    color: colors.magenta,
  },
  // Plain — sentence-case voice: drops the uppercase + wide tracking
  // so the label reads as a warm invitation, not a wizard step. Size
  // nudged up slightly to keep optical weight now that the caps are
  // gone. Used by the manifesto CTA ("Empecemos").
  labelPlain: {
    textTransform: 'none',
    letterSpacing: 0.2,
    fontFamily: typography.uiSemi,
    fontSize: 15,
  },
  labelDisabled: {
    color: colors.niebla,
  },
  labelSoftDisabled: {
    color: colors.niebla,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
})
