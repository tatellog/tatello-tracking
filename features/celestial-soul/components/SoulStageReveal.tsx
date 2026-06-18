import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { SoulStage } from '@/features/celestial-soul/types'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { CelestialSoulView } from './CelestialSoulView'

/*
 * Momento de revelación al cruzar de etapa (Nacimiento → … → Despertada).
 * CONTENIDO (no full-screen): un velo cálido sobre la app + la figura en su
 * nuevo estado + el nombre de la etapa y su línea de coach. Sagrado y sereno
 * (manifiesto: se celebra sin presión, sin confeti, sin números que dominen).
 */
export function SoulStageReveal({
  sign,
  revealedIds,
  stage,
  onClose,
}: {
  sign: ZodiacSign
  revealedIds: readonly string[]
  stage: SoulStage
  onClose: () => void
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Velo cálido — atenúa la app detrás sin taparla del todo. */}
        <Animated.View
          entering={FadeIn.duration(420)}
          exiting={FadeOut.duration(240)}
          style={styles.scrim}
        />

        <SafeAreaView style={styles.safe}>
          <Animated.View
            entering={FadeInDown.duration(560).springify().damping(20)}
            style={styles.card}
          >
            <CelestialSoulView sign={sign} revealedIds={revealedIds} size={232} />

            <Text style={styles.eyebrow}>{stage.name.toUpperCase()}</Text>
            <Text style={styles.line}>{stage.line}</Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Continuar"
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Continuar</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, opacity: 0.9 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    marginTop: 18,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 3,
    color: colors.oro,
    textAlign: 'center',
  },
  line: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
    textAlign: 'center',
    lineHeight: typography.sizes.displaySm * 1.18,
  },
  cta: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 34,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  ctaText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.leche,
    letterSpacing: 0.4,
  },
})
