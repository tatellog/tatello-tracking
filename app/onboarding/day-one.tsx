import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useBriefContext } from '@/features/brief/hooks'
import { DayOneTask, OrnamentShape, ProfileSummaryCard } from '@/features/onboarding/components'
import { PhotoCaptureCard } from '@/features/onboarding/photos/components/PhotoCaptureCard'
import { usePhotosToday, type PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'
import { useProfile } from '@/features/profile/hooks'
import { markVisitedDayOne } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

const TASKS: { num: number; text: string }[] = [
  { num: 1, text: 'Marca tu primer entreno cuando lo termines.' },
  { num: 2, text: 'Registra tu primera comida del día.' },
  { num: 3, text: 'Vuelve mañana para sellar tu segundo cuadrito.' },
]

/*
 * Día 1 — the bridge between the wizard's celebration and the real
 * Home. Layered as a scroll because the photo card + tasks together
 * push past most viewport heights, and the user shouldn't feel they
 * have to read everything before the CTA is reachable.
 *
 * The photo CTA opens the wizard at the first angle. usePhotosToday
 * keeps the slots in sync if the user comes back here after a partial
 * capture session.
 */
export default function DayOneScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: brief } = useBriefContext()
  const { data: photos = [] } = usePhotosToday()

  const handleEnter = async () => {
    await markVisitedDayOne()
    router.replace('/(tabs)')
  }

  const handleStartPhotos = () => {
    router.push('/onboarding/photos/front')
  }

  // Single-angle capture: tapping a specific slot opens the wizard
  // for just that angle and bounces back to Día 1 instead of walking
  // through the remaining three. Use case: user already captured
  // front, wants to retake side_left without re-doing the others.
  const handleSlotPress = (angle: PhotoAngle) => {
    router.push(`/onboarding/photos/${angle}?single=true`)
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.pearlBase, colors.pearlGradientEnd]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <OrnamentShape variant="tl-small" />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>Tu primer día</Text>
          <Text style={styles.title}>
            Hoy <Text style={styles.titleEmphasis}>empieza</Text>.
          </Text>
          <Text style={styles.sub}>Aquí está lo que te hará despegar.</Text>

          {profile ? (
            <View style={styles.cards}>
              <ProfileSummaryCard
                profile={profile}
                weightKg={brief?.latest_measurement?.weight_kg ?? null}
              />

              <PhotoCaptureCard
                photos={photos}
                onStartCapture={handleStartPhotos}
                onSlotPress={handleSlotPress}
              />

              <View style={styles.tasksList}>
                {TASKS.map((task) => (
                  <DayOneTask key={task.num} num={task.num} text={task.text} />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleEnter}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            accessibilityRole="button"
            accessibilityLabel="Entrar a la app"
          >
            <Text style={styles.ctaLabel}>Entrar a la app →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 38,
    color: colors.inkPrimary,
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.inkPrimary,
  },
  sub: {
    marginTop: 8,
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 20,
    color: colors.labelMuted,
    marginBottom: 24,
  },
  cards: {
    gap: 0,
  },
  tasksList: {
    gap: 8,
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
    letterSpacing: 0.3,
    color: colors.pearlBase,
  },
})
