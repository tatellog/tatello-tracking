import MaskedView from '@react-native-masked-view/masked-view'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { OrnamentShape } from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

/*
 * Opening shot of the onboarding ceremony. Centred composition with a
 * 365 stat as the protagonist, an editorial line, and a single CTA.
 *
 * The "365" wears an ink→mauve diagonal gradient via MaskedView. If
 * MaskedView ever fails on a given platform the underlying <Text>
 * still renders in inkPrimary, so the screen degrades gracefully.
 *
 * No progress bar — the wizard "starts" on the next screen so this
 * one reads as a foreword, not step 0 of 6.
 */
export default function WelcomeScreen() {
  const router = useRouter()

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/onboarding/name')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.pearlBase, colors.pearlGradientEnd]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <OrnamentShape variant="tr" />
      <OrnamentShape variant="bl" />

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
            {/* Spacer so MaskedView has bounds matching the masked text. */}
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
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Empecemos"
        >
          <Text style={styles.ctaLabel}>Empecemos</Text>
        </Pressable>
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
  // The spacer is invisible but reserves the same intrinsic width so
  // the LinearGradient inside MaskedView fills the right region.
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
    paddingBottom: 16,
  },
  cta: {
    backgroundColor: colors.mauveDeep,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 15,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
})
