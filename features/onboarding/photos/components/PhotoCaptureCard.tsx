import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import type { PhotoAngle, TodayPhoto } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { colors, typography } from '@/theme'

type Props = {
  photos: TodayPhoto[]
  onStartCapture: () => void
  /**
   * Tap on a specific slot — used to capture/retake a single angle
   * out of order. Optional so callers that don't need per-slot
   * navigation can keep the static layout.
   */
  onSlotPress?: (angle: PhotoAngle) => void
}

const ANGLE_ORDER: PhotoAngle[] = ['front', 'side_right', 'side_left', 'back']

const ANGLE_LABELS: Record<PhotoAngle, string> = {
  front: 'Frente',
  side_right: 'Lateral D',
  side_left: 'Lateral I',
  back: 'Espalda',
}

/*
 * The hero card of Día 1. Subtle pearl→tinted diagonal background, a
 * 1.5px mauve border that sets it apart from the ProfileSummaryCard,
 * a slow horizontal shimmer behind the content while the user hasn't
 * captured anything, and a 2×2 grid of slots that fill in as photos
 * are taken.
 *
 * The shimmer auto-disables once all 4 are captured — at that point
 * the card stops asking for attention and just becomes a viewer.
 *
 * The CTA copy adapts: "Empezar fotos" / "Continuar fotos (2/4)" /
 * "Volver a tomar".
 */
export function PhotoCaptureCard({ photos, onStartCapture, onSlotPress }: Props) {
  const captured = useMemo(
    () =>
      Object.fromEntries(photos.map((p) => [p.angle, p])) as Partial<
        Record<PhotoAngle, TodayPhoto>
      >,
    [photos],
  )
  const capturedCount = Object.keys(captured).length
  const allDone = capturedCount === 4

  // Shimmer translateX from -1 to 1 (representing -100%..100%) so we
  // can drive it with `${value * 100}%`. We pause the loop once all
  // four photos exist; the card becomes inert.
  const shimmer = useSharedValue(-1)
  useEffect(() => {
    if (allDone) {
      shimmer.value = -1
      return
    }
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    )
  }, [allDone, shimmer])

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${shimmer.value * 100}%` }],
  }))

  const ctaCopy = useMemo(() => {
    if (capturedCount === 0) return 'Empezar fotos →'
    if (capturedCount < 4) return `Continuar fotos (${capturedCount}/4) →`
    return 'Volver a tomar'
  }, [capturedCount])

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[colors.pearlElevated, '#FCF7F9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {!allDone ? (
        <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(168, 94, 124, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <Text style={styles.eyebrow}>Recomendado</Text>
      <Text style={styles.title}>
        Captura tu <Text style={styles.titleEmphasis}>antes</Text>.
      </Text>
      <Text style={styles.sub}>
        4 fotos hoy para comparar en 30 días. La diferencia visual es donde el cambio se ve real.
      </Text>

      <View style={styles.slotsGrid}>
        {ANGLE_ORDER.map((angle) => (
          <PhotoSlot
            key={angle}
            angle={angle}
            photo={captured[angle]}
            onPress={onSlotPress ? () => onSlotPress(angle) : undefined}
          />
        ))}
      </View>

      <Pressable
        onPress={onStartCapture}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel={ctaCopy}
      >
        <LinearGradient
          colors={[colors.mauveLight, colors.mauveDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.ctaLabel}>{ctaCopy}</Text>
      </Pressable>
    </View>
  )
}

function PhotoSlot({
  angle,
  photo,
  onPress,
}: {
  angle: PhotoAngle
  photo?: TodayPhoto
  onPress?: () => void
}) {
  // The slot becomes interactive when a parent supplies onPress —
  // wraps the surface in a Pressable so taps fall through any
  // positioned children and the press style can dim the slot.
  const accessibilityLabel = photo
    ? `Volver a tomar ${ANGLE_LABELS[angle]}`
    : `Tomar foto ${ANGLE_LABELS[angle]}`

  if (photo?.signed_url) {
    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.slotFilled, pressed && styles.slotPressed]}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Image source={{ uri: photo.signed_url }} style={StyleSheet.absoluteFill} />
          <View style={styles.checkBadge}>
            <Text style={styles.checkBadgeText}>✓</Text>
          </View>
        </Pressable>
      )
    }
    return (
      <View style={styles.slotFilled}>
        <Image source={{ uri: photo.signed_url }} style={StyleSheet.absoluteFill} />
        <View style={styles.checkBadge}>
          <Text style={styles.checkBadgeText}>✓</Text>
        </View>
      </View>
    )
  }

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.slotEmpty, pressed && styles.slotPressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Text style={styles.slotPlus}>＋</Text>
        <Text style={styles.slotLabel}>{ANGLE_LABELS[angle]}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.slotEmpty}>
      <Text style={styles.slotPlus}>＋</Text>
      <Text style={styles.slotLabel}>{ANGLE_LABELS[angle]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.mauveDeep,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '60%',
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 6,
  },
  title: {
    fontFamily: typography.displayMedium,
    fontSize: 18,
    letterSpacing: -0.5,
    color: colors.inkPrimary,
    marginBottom: 6,
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  sub: {
    fontFamily: typography.ui,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.labelMuted,
    marginBottom: 12,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 6,
    marginBottom: 12,
  },
  slotEmpty: {
    width: '48.5%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderColor: colors.mauveBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(248, 240, 244, 0.5)',
  },
  slotPlus: {
    fontFamily: typography.display,
    fontSize: 22,
    color: colors.mauveDeep,
  },
  slotLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.labelMuted,
  },
  slotFilled: {
    width: '48.5%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.pearlMuted,
  },
  slotPressed: {
    opacity: 0.75,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.mauveDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: {
    fontFamily: typography.uiSemi,
    fontSize: 11,
    color: colors.pearlBase,
  },
  cta: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 100,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mauveDeep,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    letterSpacing: 0.3,
    color: colors.pearlBase,
  },
})
