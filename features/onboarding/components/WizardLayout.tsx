import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
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
}: Props) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) onBack()
    else if (router.canGoBack()) router.back()
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
          onPress={onContinue}
          disabled={!canContinue}
          loading={loading}
          pill={ctaPill}
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
    fontSize: 12,
    lineHeight: 17,
    color: colors.feedbackError,
    textAlign: 'center',
  },
})
