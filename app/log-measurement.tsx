import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import { NumberInput } from '@/features/onboarding/components'
import { useAddMeasurement } from '@/features/progress/hooks'
import { colors, radius, shadows, spacing, typography } from '@/theme'

const MIN_KG = 30
const MAX_KG = 300

/*
 * Slide-up sheet for logging a new weight reading. Defaults the
 * timestamp to "now" — the user almost always weighs themselves the
 * moment they open this screen, so we don't make them pick a time.
 * If they need to backdate, that lands in a future sprint (Pareto).
 *
 * Validates 30 ≤ kg ≤ 300 (criterion 23). Optimistic-ish: the
 * mutation invalidates progress + brief on settle, so the chart
 * picks up the new point without manual refresh.
 */
export default function LogMeasurementScreen() {
  const router = useRouter()
  const addMeasurement = useAddMeasurement()
  const [value, setValue] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const num = value === '' ? Number.NaN : Number(value)
  const isValid = Number.isFinite(num) && num >= MIN_KG && num <= MAX_KG
  const showInlineError = value.length > 0 && !isValid

  const handleSave = () => {
    if (!isValid) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setErrorMessage(null)
    addMeasurement.mutate(
      {
        weight_kg: Number(num.toFixed(2)),
        measured_at: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          Toast.show({ type: 'success', text1: 'Medida guardada' })
          router.back()
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'No pudimos guardar.'
          setErrorMessage(message)
        },
      },
    )
  }

  const nowLabel = formatNowLong(new Date())

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>NUEVA MEDIDA</Text>
            <Text style={styles.title}>
              Hoy <Text style={styles.titleEmphasis}>pesas</Text>...
            </Text>
            <Text style={styles.timestamp}>{nowLabel}</Text>
          </View>

          <NumberInput
            value={value}
            onChangeText={setValue}
            unit="kg"
            placeholder="76"
            decimal
            autoFocus
          />

          {showInlineError ? (
            <Text style={styles.error}>
              Entre {MIN_KG} y {MAX_KG} kg.
            </Text>
          ) : null}

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleSave}
            disabled={!isValid || addMeasurement.isPending}
            style={({ pressed }) => [
              styles.cta,
              !isValid && styles.ctaDisabled,
              pressed && isValid && !addMeasurement.isPending && styles.ctaPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Guardar peso"
            accessibilityState={{ disabled: !isValid, busy: addMeasurement.isPending }}
          >
            {isValid ? (
              <LinearGradient
                colors={[colors.mauveLight, colors.mauveDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {addMeasurement.isPending ? (
              <View style={styles.ctaRow}>
                <ActivityIndicator color={colors.pearlBase} size="small" />
                <Text style={styles.ctaLabel}>Guardando…</Text>
              </View>
            ) : (
              <Text style={[styles.ctaLabel, !isValid && styles.ctaLabelDisabled]}>Guardar</Text>
            )}
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function formatNowLong(d: Date): string {
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  const dayName = days[d.getDay()] ?? ''
  const monthName = months[d.getMonth()] ?? ''
  const time = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return `${dayName} ${d.getDate()} ${monthName} · ${time}`
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 28,
    letterSpacing: -1.2,
    color: colors.inkPrimary,
    lineHeight: 32,
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  timestamp: {
    marginTop: 6,
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    color: colors.labelMuted,
  },
  error: {
    marginTop: spacing.sm,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.feedbackError,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  cta: {
    overflow: 'hidden',
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMauve,
  },
  ctaDisabled: {
    backgroundColor: colors.pearlMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
  ctaLabelDisabled: {
    color: colors.labelDim,
  },
  cancel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.labelMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
})
