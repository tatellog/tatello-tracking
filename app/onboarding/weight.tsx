import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native'

import { StepHeader, useCountUp, WizardLayout } from '@/features/onboarding/components'
import { useInsertInitialWeight } from '@/features/profile/hooks'
import { saveSkipWeight } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

const MIN_KG = 30
const MAX_KG = 300

const TARGET_PLACEHOLDER = '75'

/*
 * Screen 4 · Hoy pesas. El número se enmarca como punto de partida,
 * no veredicto. Layout:
 *
 *   • Header con titulo y caveat
 *   • Número 120px Hanken 900 cream + "kg" Cormorant italic magenta
 *   • Ruler decorativa abajo del input (21 ticks, cada 5to mayor y
 *     magenta)
 *   • Caveat italic "Es solo el punto de partida. / No es tu valor."
 *   • Skip link "No tengo báscula · registrar después"
 *
 * Count-up animation: al montar (y mientras el usuario no toque el
 * input), el número anima 0 → placeholder (75). En cuanto el usuario
 * escribe, pasamos `paused = true` al hook y el counter cede control.
 */
export default function WeightScreen() {
  const router = useRouter()
  const insertWeight = useInsertInitialWeight()
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [skip, setSkip] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingError, setSavingError] = useState<string | null>(null)

  // Mientras el usuario no haya tocado y skip esté apagado, mostramos
  // la animación count-up sobre el placeholder.
  const animated = useCountUp(TARGET_PLACEHOLDER, {
    duration: 1400,
    startDelay: 350,
    paused: touched || skip,
  })

  const num = value === '' ? Number.NaN : Number(value)
  const isValid = Number.isFinite(num) && num >= MIN_KG && num <= MAX_KG
  const canContinue = skip || isValid
  const showError = touched && value.length > 0 && !skip && !isValid

  const handleContinue = async () => {
    if (!canContinue) return
    setSavingError(null)
    setSaving(true)

    try {
      if (skip) {
        await saveSkipWeight(true)
      } else {
        await saveSkipWeight(false)
        await insertWeight.mutateAsync(Number(num.toFixed(1)))
      }
      router.push('/onboarding/appointment')
    } catch (e) {
      setSavingError(e instanceof Error ? e.message : 'No pudimos guardar tu peso.')
    } finally {
      setSaving(false)
    }
  }

  const display = skip ? '—' : touched ? value : animated

  return (
    <KeyboardAvoidingView
      style={styles.kb}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <WizardLayout
        step={4}
        canContinue={canContinue}
        loading={saving}
        errorMessage={savingError ?? insertWeight.error?.message ?? null}
        onContinue={handleContinue}
      >
        <StepHeader
          eyebrow="El punto de partida"
          eyebrowColor="magenta"
          question="Hoy pesas…"
          questionEmphasis="pesas"
          hint="No es un veredicto. Es solo de dónde empezamos."
        />

        <View style={styles.body}>
          <View style={styles.row}>
            <TextInput
              value={display}
              onChangeText={(t) => {
                setTouched(true)
                const cleaned = t.replace(/[^0-9.,]/g, '').replace(',', '.')
                const parts = cleaned.split('.')
                const next =
                  parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 1)}` : cleaned
                setValue(next.slice(0, 5))
              }}
              editable={!skip}
              placeholder="75"
              placeholderTextColor={colors.bruma}
              keyboardType="decimal-pad"
              selectionColor={colors.magenta}
              style={[styles.number, skip && styles.numberDisabled]}
              maxLength={5}
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          <View style={styles.ruler} pointerEvents="none">
            {Array.from({ length: 21 }).map((_, i) => (
              <View
                key={i}
                style={[styles.tick, i % 5 === 0 ? styles.tickMajor : styles.tickMinor]}
              />
            ))}
          </View>

          {showError ? (
            <Text style={styles.error}>
              Entre {MIN_KG} y {MAX_KG} kg.
            </Text>
          ) : null}

          <View style={styles.spacer} />

          <Text style={styles.caveat}>Es solo el punto de partida.{'\n'}No es tu valor.</Text>

          <Text
            style={styles.skipLink}
            onPress={() => {
              setSkip((prev) => !prev)
              setTouched(true)
              setValue('')
            }}
            suppressHighlighting
          >
            {skip ? 'Sí tengo báscula · anotar peso' : 'No tengo báscula · registrar después'}
          </Text>
        </View>
      </WizardLayout>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kb: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    paddingTop: 28,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  number: {
    width: 180,
    textAlign: 'right',
    fontFamily: typography.displayHeavy,
    fontSize: 120,
    color: colors.leche,
    letterSpacing: -6,
    backgroundColor: 'transparent',
    padding: 0,
    // line-height 0.9 en CSS → en RN se traduce a fontSize * 0.9 = 108
    lineHeight: 108,
  },
  numberDisabled: {
    color: colors.niebla,
  },
  unit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 26,
    color: colors.magenta,
  },
  ruler: {
    width: '92%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 18,
    opacity: 0.35,
    marginTop: 4,
  },
  tick: {
    width: 1,
  },
  tickMinor: {
    height: 6,
    backgroundColor: colors.bone,
  },
  tickMajor: {
    height: 14,
    backgroundColor: colors.magenta,
  },
  spacer: {
    flex: 1,
  },
  error: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 11,
    color: colors.feedbackError,
  },
  caveat: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 240,
  },
  skipLink: {
    marginTop: 18,
    marginBottom: 4,
    fontFamily: typography.uiBold,
    fontSize: 11,
    color: colors.magenta,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
})
