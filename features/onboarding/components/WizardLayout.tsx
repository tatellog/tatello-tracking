import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta, type CtaTransform, type CtaVariant } from '@/components/PrimaryCta'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { ProgressBar } from './ProgressBar'
import { WizardBackdrop } from './WizardBackdrop'

type Props = {
  step: number
  totalSteps?: number
  showBack?: boolean
  canContinue: boolean
  onContinue: () => void
  onBack?: () => void
  children: ReactNode
  continueLabel?: string
  loading?: boolean
  errorMessage?: string | null
  /** Render the bottom CTA as a pill (border-radius 100) — used by
   *  the new identidad / cuerpo onboarding screens. */
  ctaPill?: boolean
  /** Pass-through CTA variant (default `primary`). Lets a step opt the
   *  shared CTA into the calmer `soft` language used by welcome /
   *  que-hace without each step re-implementing the footer. Default
   *  undefined → PrimaryCta's own default (`primary`), so the other
   *  nine wizard steps are unaffected. */
  ctaVariant?: CtaVariant
  /** Pass-through CTA label casing (default `uppercase`). Pass `none`
   *  for a sentence-case label. Default undefined → PrimaryCta's own
   *  default, so the other nine steps are unaffected. */
  ctaTransform?: CtaTransform
  /** Optional full-screen atmosphere, mounted in absoluteFill JUST
   *  AFTER the backdrop and BEHIND the content (pointerEvents none).
   *  Lets a step paint depth (AtmosphericSky / WarmBloomField / star
   *  strata) without leaving WizardLayout (which already owns back,
   *  analytics, error + loading). Default undefined → the other nine
   *  steps render exactly as before. */
  atmosphere?: ReactNode
}

export function WizardLayout({
  step,
  totalSteps = 5,
  showBack = true,
  canContinue,
  onContinue,
  onBack,
  children,
  continueLabel = 'Continuar →',
  loading = false,
  errorMessage = null,
  ctaPill = false,
  ctaVariant,
  ctaTransform,
  atmosphere,
}: Props) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) onBack()
    else if (router.canGoBack()) router.back()
  }

  // Wrap the caller's onContinue so every step advance fires the
  // analytics event without each onboarding screen having to remember.
  const handleContinue = () => {
    track('onboarding_step_completed', { step })
    onContinue()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Per-screen cosmic backdrop. Used to be in the layout root
          shared across all screens, but the Stack's slide_from_right
          + transparent contentStyle let the previous screen show
          through during the 240 ms slide. Wrapping each screen with
          its own backdrop + an opaque contentStyle means each screen
          covers its neighbour cleanly during transitions. */}
      <WizardBackdrop />
      {/* Optional full-screen atmosphere — z-order: backdrop →
          atmosphere → content → footer/CTA. pointerEvents none so it
          never intercepts touches on the chips / CTA. Default
          undefined → not rendered, so the other steps are identical. */}
      {atmosphere ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {atmosphere}
        </View>
      ) : null}
      <View style={styles.progressWrap}>
        <ProgressBar current={step} total={totalSteps} />
      </View>

      {showBack ? (
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backWrap}>
          <EyebrowLabel tone="niebla" size={10} tracking={2.4}>
            ‹ Atrás
          </EyebrowLabel>
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}

      <View style={styles.content}>{children}</View>

      {errorMessage ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {errorMessage}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <PrimaryCta
          label={continueLabel}
          onPress={handleContinue}
          disabled={!canContinue}
          loading={loading}
          pill={ctaPill}
          variant={ctaVariant}
          transform={ctaTransform}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  // Opaque page bg so the screen covers its neighbour during the
  // Stack's slide transition. The backdrop renders on top of this
  // (absolutely positioned) and the screen content renders on top of
  // the backdrop.
  safe: { flex: 1, backgroundColor: colors.bg },
  progressWrap: { paddingHorizontal: 24, paddingTop: 12 },
  backWrap: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 4 },
  backSpacer: { height: 22 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  footer: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 12 },
  errorText: {
    paddingHorizontal: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    lineHeight: 17,
    color: colors.feedbackError,
    textAlign: 'center',
  },
})
