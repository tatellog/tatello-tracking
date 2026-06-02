import { KeyboardAvoidingView, Platform, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SkyBackground } from '@/features/tabs/components/SkyBackground'
import { colors, spacing } from '@/theme'

import { BrandAnchor } from './BrandAnchor'
import { HorizonConstellation } from './HorizonConstellation'
import { LightDust } from './LightDust'

type AuthScreenLayoutProps = {
  children: React.ReactNode
  /** Forwarded to BrandAnchor for the reset "revisa tu correo" pulse. */
  anchorPulseOnce?: boolean
  contentStyle?: ViewStyle
}

/*
 * The shared auth chrome: the celestial backdrop (SkyBackground +
 * LightDust + HorizonConstellation + BrandAnchor) plus keyboard-aware
 * content padding. Each screen re-mounts this — the re-mount is cheap (one
 * small scoped Lottie behind the hero, the rest is seeded static SVG) and
 * it keeps the Stack transitions simple. See the file-level note in the
 * handoff for why we didn't make the sky a single persistent layer in
 * _layout.
 */
export function AuthScreenLayout({
  children,
  anchorPulseOnce,
  contentStyle,
}: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <SkyBackground />
      <LightDust />
      {/* Faint constellation low on the horizon — fills the empty lower
          half without noise (static SVG, no TTI cost). */}
      <HorizonConstellation />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.content,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
            contentStyle,
          ]}
        >
          <View style={styles.anchor}>
            <BrandAnchor pulseOnce={anchorPulseOnce} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  anchor: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
})
