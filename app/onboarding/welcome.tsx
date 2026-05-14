import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryCta } from '@/components/PrimaryCta'
import { ManifiestoOrb, ProgressBar } from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

// Step 1 — Manifiesto. Standalone scaffold (not WizardLayout) because
// it has no back link and the decorative orb is absolute-positioned.
export default function ManifiestoScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.progressWrap}>
        <ProgressBar current={1} total={5} />
      </View>

      <View style={styles.stage}>
        <ManifiestoOrb />

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
        <PrimaryCta label="Empezar →" onPress={() => router.push('/onboarding/frictions')} />
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
})
