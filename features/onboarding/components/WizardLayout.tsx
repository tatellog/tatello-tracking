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

import { colors, typography } from '@/theme'

import { OrnamentShape, type OrnamentVariant } from './OrnamentShape'
import { ProgressBar } from './ProgressBar'

type Props = {
  step: number
  totalSteps: number
  showBack?: boolean
  canContinue: boolean
  onContinue: () => void
  onBack?: () => void
  children: ReactNode
  continueLabel?: string
  showOrnaments?: boolean
  ornamentVariant?: OrnamentVariant
  /** Disables the Continue button briefly while a mutation runs. */
  loading?: boolean
  /**
   * Inline error rendered just above the footer when a mutation
   * rejects. Pass `mutation.error?.message ?? null` from the screen.
   */
  errorMessage?: string | null
}

/*
 * Wraps every wizard step (welcome and done don't use this — they're
 * full-bleed celebration screens). Provides:
 *   - Pearl background + a barely-there pearl→tinted vertical gradient
 *   - Optional malva ornament blob
 *   - Progress bar pinned to the top
 *   - Centred content area for the step's StepHeader + input
 *   - Footer with "‹ Atrás" + "Continuar →" buttons
 *
 * The "Atrás" button defaults to router.back(); pass onBack to override
 * (some steps need to invalidate state before walking back).
 */
export function WizardLayout({
  step,
  totalSteps,
  showBack = true,
  canContinue,
  onContinue,
  onBack,
  children,
  continueLabel = 'Continuar →',
  showOrnaments = true,
  ornamentVariant = 'tr',
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
      {showOrnaments ? <OrnamentShape variant={ornamentVariant} /> : null}

      <View style={styles.progressWrap}>
        <ProgressBar current={step} total={totalSteps} />
      </View>

      <View style={styles.content}>{children}</View>

      {errorMessage ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {showBack ? (
            <Pressable onPress={handleBack} hitSlop={12}>
              <Text style={styles.backLabel}>‹ Atrás</Text>
            </Pressable>
          ) : null}
        </View>
        {/* TouchableOpacity, not Pressable: the function-style prop
            on Pressable was failing to render backgroundColor on
            some iOS native + RN combos, leaving the CTA invisible. */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={isContinueDisabled}
          activeOpacity={0.85}
          style={[styles.continue, isContinueDisabled && styles.continueDisabled]}
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
          accessibilityState={{ disabled: isContinueDisabled, busy: loading }}
        >
          {loading ? (
            <View style={styles.continueLoadingRow}>
              <ActivityIndicator color={colors.pearlBase} size="small" />
              <Text style={styles.continueLabel}>Guardando…</Text>
            </View>
          ) : (
            <Text style={styles.continueLabel}>{continueLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  progressWrap: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 12,
  },
  footerLeft: {
    minWidth: 56,
    height: 24,
    justifyContent: 'center',
  },
  backLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.labelMuted,
    letterSpacing: 0.2,
  },
  continue: {
    backgroundColor: colors.mauveDeep,
    borderRadius: 100,
    paddingHorizontal: 22,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueDisabled: {
    opacity: 0.4,
  },
  continueLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
  continueLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorWrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  errorText: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.feedbackError,
    textAlign: 'center',
  },
})
