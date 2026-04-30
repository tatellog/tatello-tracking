import MaskedView from '@react-native-masked-view/masked-view'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { OrnamentShape } from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

/*
 * Opening shot of the onboarding ceremony. Centred composition with
 * the 365 stat as the protagonist and a single CTA at the bottom.
 *
 * Implementation notes (post-iOS debugging):
 *   - TouchableOpacity (not Pressable) for the CTA. Pressable's
 *     `style` prop accepts a function that takes the press state, but
 *     in some iOS native + RN combos the function path skips
 *     backgroundColor entirely, painting the surface transparent.
 *     TouchableOpacity uses a plain object style and renders
 *     reliably.
 *   - The screen background is a flat `colors.pearlBase` on the
 *     SafeAreaView. We dropped the absoluteFill LinearGradient
 *     because in iOS native it occasionally promoted itself above
 *     static-positioned children regardless of JSX order or zIndex.
 *     The pearl→pearlGradientEnd transition is barely visible to
 *     begin with — flat pearl reads identical at this contrast.
 */
export default function WelcomeScreen() {
  const router = useRouter()

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/onboarding/name')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OrnamentShape variant="tr" />

      <View style={styles.content}>
        <View style={styles.heroBlock}>
          <MaskedView
            style={styles.bigNumberMask}
            maskElement={
              <View style={styles.bigNumberMaskInner}>
                <Text style={styles.bigNumber}>365</Text>
              </View>
            }
          >
            <LinearGradient
              colors={[colors.inkPrimary, colors.mauveDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Spacer reserves the same intrinsic width so the masked
                gradient fills the right region. */}
            <Text style={[styles.bigNumber, styles.bigNumberSpacer]}>365</Text>
          </MaskedView>
          <Text style={styles.bigNumberSub}>DÍAS POR DELANTE</Text>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>
            Tu cuerpo se transforma <Text style={styles.titleEmphasis}>cada día</Text>.
          </Text>
          <Text style={styles.subtitle}>
            Vamos a empezar a notarlo. Toma menos de un minuto conocernos.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleStart}
          style={styles.cta}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Empecemos"
        >
          <Text style={styles.ctaLabel}>Empecemos</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 36,
  },
  heroBlock: {
    alignItems: 'center',
  },
  bigNumberMask: {
    height: 92,
    width: 220,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  bigNumberMaskInner: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigNumber: {
    fontFamily: typography.display,
    fontSize: 80,
    letterSpacing: -3,
    color: colors.inkPrimary,
    textAlign: 'center',
    lineHeight: 92,
  },
  bigNumberSpacer: {
    opacity: 0,
    position: 'absolute',
  },
  bigNumberSub: {
    marginTop: 8,
    fontFamily: typography.uiSemi,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.labelMuted,
  },
  copyBlock: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  subtitle: {
    fontFamily: typography.ui,
    fontSize: 14,
    lineHeight: 22,
    color: colors.labelMuted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 16,
  },
  cta: {
    width: '100%',
    backgroundColor: colors.mauveDeep,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 15,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
})
