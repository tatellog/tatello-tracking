import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ManifOrb, ProgressBar } from '@/features/onboarding/components'
import { colors, shadows, typography } from '@/theme'

/*
 * Screen 1 · Manifiesto. La pantalla de bienvenida — no pide nada,
 * sólo comunica filosofía. Layout:
 *
 *   • Progress bar (1/5)
 *   • Eyebrow magenta uppercase "NORTE · EL MANIFIESTO"
 *   • Quote 44px Hanken 900:
 *       "La perfección
 *        no es necesaria."
 *       (block) "La dirección sí." — Cormorant italic magenta
 *   • Hairline magenta 36×1
 *   • Meta paragraph bone con "**En 28 días**" en italic magenta
 *   • CTA "Empezar →"
 *   • Orb decorativo absoluto al fondo-derecha
 *
 * El layout heredado del prototype HTML pone la quota centrada
 * vertical-ish con `justify-content: center`; aquí el `flex: 1` del
 * stage la centra entre el progress bar y el CTA.
 *
 * Nota: usamos directamente SafeAreaView en vez de WizardLayout
 * porque el padding del manifiesto difiere (no hay back link, hay
 * orb decorativo absoluto). Conserva el mismo padding lateral 24.
 */
export default function ManifiestoScreen() {
  const router = useRouter()

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/onboarding/frictions')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.progressWrap}>
        <ProgressBar current={1} total={5} />
      </View>

      <View style={styles.stage}>
        <ManifOrb />

        <View style={styles.content}>
          <Text style={styles.eyebrow}>Norte · el manifiesto</Text>
          <Text style={styles.quote}>La perfección{'\n'}no es necesaria.</Text>
          <Text style={styles.quoteEmphasis}>La dirección sí.</Text>
          <View style={styles.rule} />
          <Text style={styles.meta}>
            Esta app te lee patrones, no perfección.{'\n'}
            <Text style={styles.metaStrong}>En 28 días</Text> verás tu primera comparativa.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleStart}
          activeOpacity={0.85}
          style={styles.cta}
          accessibilityRole="button"
          accessibilityLabel="Empezar"
        >
          <Text style={styles.ctaLabel}>Empezar →</Text>
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
  stage: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    color: colors.magenta,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  quote: {
    fontFamily: typography.displayHeavy,
    fontSize: 44,
    lineHeight: 44,
    color: colors.leche,
    letterSpacing: -2,
  },
  quoteEmphasis: {
    marginTop: 8,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 40,
    color: colors.magenta,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  rule: {
    marginTop: 22,
    marginBottom: 16,
    width: 36,
    height: 1,
    backgroundColor: colors.magenta,
  },
  meta: {
    maxWidth: 240,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.bone,
  },
  metaStrong: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.magenta,
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
  ctaLabel: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
  },
})
