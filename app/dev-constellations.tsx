import { FlatList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LunarConstellation, SkyBackground } from '@/features/tabs/components'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

/*
 * Dev-only test view — renders all 12 constellations side by side
 * so we can visually validate that each sign's asterism aligns
 * with its zodiac-art SVG without having to swap profile dates
 * in the database. Each card is fed a fully-trained 28-day grid
 * so the entire figure lights up.
 *
 * Route: /dev-constellations
 */

const ALL_SIGNS: ZodiacSign[] = [
  'aries',
  'tauro',
  'geminis',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'escorpio',
  'sagitario',
  'capricornio',
  'acuario',
  'piscis',
]

// 28 days all completed so every sign renders its full constellation.
const ALL_TRAINED: readonly boolean[] = Array.from({ length: 28 }, () => true)

function renderSignCard({ item: sign }: { item: ZodiacSign }) {
  return (
    <View style={styles.signBlock}>
      <Text style={styles.signLabel}>Tu {ZODIAC[sign].label}</Text>
      <View style={styles.constellationWrap}>
        <LunarConstellation trained={ALL_TRAINED} todayIdx={27} sign={sign} committed={true} />
      </View>
    </View>
  )
}

export default function DevConstellationsScreen() {
  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Test · todas las constelaciones</Text>
          <Text style={styles.subtitle}>28/28 cada signo</Text>
        </View>
        {/* FlatList virtualises — only mounts the cards currently
            on screen + a small buffer. Each LunarConstellation
            spins up ~100 Reanimated worklets (ambient field, deep
            field, nebula, dust, winks, per-star halos), so
            mounting all 12 at once locks the UI for several
            seconds. windowSize 2 + initialNumToRender 1 keeps the
            UI responsive while scrolling. */}
        <FlatList
          data={ALL_SIGNS}
          keyExtractor={(sign) => sign}
          renderItem={renderSignCard}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={2}
          removeClippedSubviews
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.leche,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 12,
    color: colors.niebla,
    marginTop: 2,
  },
  content: {
    paddingBottom: 60,
  },
  signBlock: {
    marginBottom: 32,
    alignItems: 'center',
  },
  signLabel: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.leche,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  // Same full-bleed treatment as the main Hoy tab so each card
  // renders at its real production size.
  constellationWrap: {
    width: '100%',
  },
})
