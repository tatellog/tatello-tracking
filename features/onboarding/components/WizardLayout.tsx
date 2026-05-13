import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, shadows, typography } from '@/theme'

import { ProgressBar } from './ProgressBar'

type Props = {
  step: number
  totalSteps?: number
  showBack?: boolean
  canContinue: boolean
  onContinue: () => void
  onBack?: () => void
  children: ReactNode
  continueLabel?: string
  /** Disables the Continue button briefly while a mutation runs. */
  loading?: boolean
  /**
   * Inline error rendered just above the footer when a mutation
   * rejects. Pass `mutation.error?.message ?? null` from the screen.
   */
  errorMessage?: string | null
}

/*
 * Norte wizard scaffold — la estructura compartida de los 5 steps
 * (screen 1 manifiesto usa ManifiestoScreen directamente porque su
 * decoración orb se ancla absolute al fondo). Provee:
 *
 *   • Background bg dark
 *   • Progress bar arriba (5 segmentos)
 *   • Back link uppercase (excepto en step 1)
 *   • Centred content area
 *   • Primary CTA magenta full-width (54px alto, radius 4)
 *
 * Padding del README: 60px arriba / 24px laterales / 32px abajo.
 * El SafeAreaView se encarga del top, así que padding-top adicional
 * se baja a 24px.
 */
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
}: Props) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (router.canGoBack()) {
      router.back()
    }
  }

  const handleContinue = () => {
    if (!canContinue || loading) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    onContinue()
  }

  const isContinueDisabled = !canContinue || loading

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.progressWrap}>
        <ProgressBar current={step} total={totalSteps} />
      </View>

      {showBack ? (
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backWrap}>
          <Text style={styles.backLabel}>‹ Atrás</Text>
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
        <TouchableOpacity
          onPress={handleContinue}
          disabled={isContinueDisabled}
          activeOpacity={0.85}
          style={[styles.cta, isContinueDisabled && styles.ctaDisabled]}
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
          accessibilityState={{ disabled: isContinueDisabled, busy: loading }}
        >
          {loading ? (
            <View style={styles.ctaLoadingRow}>
              <ActivityIndicator color={colors.leche} size="small" />
              <Text style={[styles.ctaLabel, isContinueDisabled && styles.ctaLabelDisabled]}>
                Guardando…
              </Text>
            </View>
          ) : (
            <Text style={[styles.ctaLabel, isContinueDisabled && styles.ctaLabelDisabled]}>
              {continueLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  backWrap: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 4,
  },
  backSpacer: {
    height: 22,
  },
  backLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
  cta: {
    height: 54,
    borderRadius: 4,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMagenta,
  },
  ctaDisabled: {
    backgroundColor: colors.bgCard2,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaLabel: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
  },
  ctaLabelDisabled: {
    color: colors.niebla,
  },
  ctaLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    paddingHorizontal: 24,
    fontFamily: typography.uiMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.feedbackError,
    textAlign: 'center',
  },
})
