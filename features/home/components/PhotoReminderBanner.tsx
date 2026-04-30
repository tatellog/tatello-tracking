import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  daysAgo: number
}

/*
 * Mauve banner that surfaces on the Home once 30+ days have passed
 * since the user's last complete 4-angle photo set. Tap "Capturar"
 * deep-links into the photo wizard at the front angle with
 * ?source=reminder so the wizard returns to the tabs after the set,
 * not to /onboarding/day-one.
 */
export function PhotoReminderBanner({ daysAgo }: Props) {
  const router = useRouter()

  const handleCapture = () => {
    router.push('/onboarding/photos/front?source=reminder')
  }

  return (
    <View style={styles.banner}>
      <LinearGradient
        colors={[colors.mauveLight, colors.mauveDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.textWrap}>
        <Text style={styles.eyebrow}>Han pasado {daysAgo} días</Text>
        <Text style={styles.text}>Captura tus fotos de hoy para ver el cambio.</Text>
      </View>
      <Pressable
        onPress={handleCapture}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Capturar fotos de seguimiento"
      >
        <Text style={styles.ctaLabel}>Capturar →</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textWrap: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
  },
  text: {
    fontFamily: typography.ui,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.pearlBase,
  },
  cta: {
    backgroundColor: colors.pearlBase,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.mauveDeep,
  },
})
