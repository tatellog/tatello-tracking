import { Stack, useLocalSearchParams } from 'expo-router'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { LunarConstellation, SkyBackground } from '@/features/tabs/components'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

/*
 * Dev-only — detalle de un signo: el HERO completo (Emblema Celeste +
 * constelación natal) a varios porcentajes, para ver el reveal del
 * emblema junto con la constelación. La constelación se enciende
 * proporcional al % (ambos sistemas crecen juntos en el catálogo).
 * Se llega desde /dev-emblem-signs.
 *
 * Route: /dev-emblem-signs/<sign>
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

const TARGET = 28
const PCTS = [0, 20, 40, 60, 80, 100] as const

// Grid de `n` días completados (primeros n true) → enciende n estrellas.
function grid(n: number): boolean[] {
  return Array.from({ length: TARGET }, (_, i) => i < n)
}

function isSign(s: string | undefined): s is ZodiacSign {
  return !!s && (ALL_SIGNS as string[]).includes(s)
}

export default function DevEmblemSignDetail() {
  const { sign } = useLocalSearchParams<{ sign: string }>()

  if (!isSign(sign)) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'signo?' }} />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <DevBackButton label="Signos" />
          <Text style={styles.notFound}>signo no encontrado: {sign}</Text>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: ZODIAC[sign].label }} />
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton label="Signos" />
        <View style={styles.header}>
          <Text style={styles.title}>{ZODIAC[sign].label}</Text>
          <Text style={styles.subtitle}>Emblema + constelación por porcentaje</Text>
        </View>
        {/* Cada celda es un LunarConstellation completo (Skia + ~100
            worklets); FlatList virtualiza agresivo para no trabar. */}
        <FlatList
          data={PCTS}
          keyExtractor={(p) => String(p)}
          renderItem={({ item: p }) => {
            const trained = Math.round((p / 100) * TARGET)
            return (
              <View style={styles.card}>
                <View style={styles.constellationWrap}>
                  <LunarConstellation
                    trained={grid(trained)}
                    todayIdx={Math.max(0, trained - 1)}
                    target={TARGET}
                    sign={sign}
                    committed
                    showCount={false}
                    suppressBurst
                    transformProgressOverride={p}
                    showStarLabels
                  />
                </View>
                <Text style={styles.pctLabel}>
                  emblema {p}% · constelación {trained}/{TARGET}
                </Text>
              </View>
            )
          }}
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
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  card: {
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  constellationWrap: {
    aspectRatio: 1,
    width: '100%',
  },
  pctLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.bruma,
    marginTop: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  notFound: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 40,
  },
})
