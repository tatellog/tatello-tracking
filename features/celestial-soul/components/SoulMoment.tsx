import type { ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

import { CelestialSoulView } from './CelestialSoulView'

/*
 * Momento de revelación del Alma Celeste — CONTENIDO (no full-screen): velo
 * cálido sobre la app + la figura en su estado actual + un eyebrow y una línea
 * de coach (y un icono opcional para las regiones). Sereno, sin presión. Lo
 * reusan los tres momentos: cruce de etapa, región al 100%, y el final.
 */
export function SoulMoment({
  sign,
  revealedIds,
  eyebrow,
  line,
  icon,
  onClose,
}: {
  sign: ZodiacSign
  revealedIds: readonly string[]
  eyebrow: string
  line: string
  icon?: ReactNode
  onClose: () => void
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
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

            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.line}>{line}</Text>

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
  icon: { marginTop: 16 },
  eyebrow: {
    marginTop: 14,
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
