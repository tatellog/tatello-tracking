import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { OrnamentShape } from '@/features/onboarding/components'
import { usePhotosToday, type PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { colors, typography } from '@/theme'

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Frente',
  side_right: 'Lateral D',
  side_left: 'Lateral I',
  back: 'Espalda',
}

const ANGLE_ORDER: PhotoAngle[] = ['front', 'side_right', 'side_left', 'back']

/*
 * Closing scene of the photo wizard. Same vocabulary as the wizard's
 * Done screen — animated check, headline with mauve emphasis, soft
 * subtitle — but the focus is the 2×2 grid of thumbnails so the user
 * sees their "antes" cement into the record.
 *
 * "Volver a Día 1" is the default destination; if the wizard was
 * launched from the 30-day reminder banner (?source=reminder) we
 * route back to the Home tabs instead.
 */
export default function PhotosDoneScreen() {
  const router = useRouter()
  const { source } = useLocalSearchParams<{ source?: string }>()
  const { data: photos = [] } = usePhotosToday()

  const checkScale = useSharedValue(0)

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    checkScale.value = withSequence(
      withTiming(1.15, { duration: 380, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
      withSpring(1, { stiffness: 100, damping: 12 }),
    )
  }, [checkScale])

  const checkAnim = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }))

  const destination = source === 'reminder' ? '/(tabs)' : '/onboarding/day-one'
  const ctaLabel = source === 'reminder' ? 'Volver al inicio' : 'Volver a Día 1'

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.replace(destination)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[colors.pearlBase, colors.pearlGradientEnd]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <OrnamentShape variant="br" />

      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, checkAnim]}>
          <LinearGradient
            colors={[colors.mauveLight, colors.mauveDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.checkIcon}>✓</Text>
        </Animated.View>

        <Text style={styles.title}>
          Tu <Text style={styles.titleEmphasis}>antes</Text> queda guardado.
        </Text>
        <Text style={styles.sub}>En 30 días te avisamos para tomar las siguientes y comparar.</Text>

        <View style={styles.grid}>
          {ANGLE_ORDER.map((angle) => {
            const photo = photos.find((p) => p.angle === angle)
            return (
              <View key={angle} style={styles.thumb}>
                {photo?.signed_url ? (
                  <Image source={{ uri: photo.signed_url }} style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={styles.thumbPlaceholder} />
                )}
                <View style={styles.thumbLabelWrap}>
                  <Text style={styles.thumbLabel}>{ANGLE_LABELS[angle]}</Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mauveDeep,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  checkIcon: {
    fontFamily: typography.display,
    fontSize: 26,
    color: colors.pearlBase,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 28,
    letterSpacing: -1,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  sub: {
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 20,
    color: colors.labelMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  thumb: {
    width: '46%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.inkDark,
    position: 'relative',
  },
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cameraDark,
  },
  thumbLabelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
  },
  thumbLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.pearlBase,
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 12,
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
