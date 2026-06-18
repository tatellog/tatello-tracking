import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { withDevGuard } from '@/components/withDevGuard'
import { ConstellationCompletionReveal } from '@/features/revelations/components/ConstellationCompletionReveal'
import { SkyBackground } from '@/features/tabs/components'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

const SIGNS = Object.keys(ZODIAC) as ZodiacSign[]

function DevSoulRevealScreen() {
  const [sign, setSign] = useState<ZodiacSign>('leo')
  // `playKey` re-monta la ceremonia desde cero en cada reproducción.
  const [playKey, setPlayKey] = useState<number | null>(null)

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <DevBackButton />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Ceremonia · Constelación ✦v13</Text>
          <Text style={styles.hint}>
            Elige un signo y reproduce la secuencia (≈11 s + el CTA). Se reproduce sola.
          </Text>

          <Text style={styles.label}>Signo</Text>
          <View style={styles.signGrid}>
            {SIGNS.map((s) => {
              const active = s === sign
              return (
                <Pressable
                  key={s}
                  onPress={() => setSign(s)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {ZODIAC[s].label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Botón ABSOLUTO pegado al fondo, sobre el SafeAreaView — fuera del
          flujo flex, imposible que lo colapse el ScrollView o el safe-area. */}
      <View style={styles.footer} pointerEvents="box-none">
        <Pressable
          onPress={() => setPlayKey((k) => (k ?? 0) + 1)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.play, pressed && styles.pressed]}
        >
          <Text style={styles.playText}>Reproducir ceremonia</Text>
        </Pressable>
      </View>

      {playKey != null ? (
        <ConstellationCompletionReveal
          key={playKey}
          sign={sign}
          onContinue={() => setPlayKey(null)}
          onClose={() => setPlayKey(null)}
        />
      ) : null}
    </View>
  )
}

export default withDevGuard(DevSoulRevealScreen)

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  footer: { position: 'absolute', left: 20, right: 20, bottom: 48 },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    marginTop: 8,
  },
  hint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 12,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 8,
  },
  signGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  chipActive: { borderColor: colors.oro, backgroundColor: colors.oroTint },
  chipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    letterSpacing: 1,
    color: colors.bone,
  },
  chipTextActive: { color: colors.leche },
  play: {
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.oro,
    borderWidth: 1,
    borderColor: colors.oroLight,
  },
  playText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.3,
    color: colors.bg,
  },
  pressed: { opacity: 0.6 },
})
