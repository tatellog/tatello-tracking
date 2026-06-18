import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { CelestialSoulView } from '@/features/celestial-soul/components/CelestialSoulView'
import { RegionIcon } from '@/features/celestial-soul/components/RegionIcon'
import { useSoulProgress } from '@/features/celestial-soul/hooks'
import { AWAKENING_LABEL, stageForPct } from '@/features/celestial-soul/logic'
import type { SoulRegionKey } from '@/features/celestial-soul/types'
import { SOURCE_ACTION } from '@/features/celestial-soul/config'
import { useProfile } from '@/features/profile/hooks'
import { SkyBackground } from '@/features/tabs/components'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

/*
 * Tu Alma Celeste · pantalla completa. La figura ya está completa y visible
 * (hero, tamaño emblema); alrededor despiertan los 6 SISTEMAS. Esta pantalla
 * deja VER el progreso de cada región y ENTRAR a una para conocer su
 * significado. No promete, no presiona: observa cómo tu cosmos cobra vida.
 *
 * Datos reales vía useSoulProgress(signo). El signo sale de la fecha de
 * nacimiento del perfil; sin perfil, la pantalla no fuerza un estado falso.
 */

export default function AlmaCelesteScreen() {
  return (
    <ErrorBoundary screen="alma-celeste">
      <AlmaCelesteBody />
    </ErrorBoundary>
  )
}

function AlmaCelesteBody() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const sign = profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : null

  const [focused, setFocused] = useState<SoulRegionKey | null>(null)

  const { revealed, progress, config } = useSoulProgress(sign ?? 'leo')
  const revealedIds = sign ? Array.from(revealed) : []

  const stage = stageForPct(progress.pct)

  return (
    <View style={styles.screen}>
      <SkyBackground />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title}>Alma Celeste</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sign ? (
            <>
              {/* Hero — la figura completa + sistemas vivos. */}
              <CelestialSoulView sign={sign} revealedIds={revealedIds} style={styles.soul} />

              <Text style={styles.stageEyebrow}>
                {stage.name.toUpperCase()} · {progress.pct}%
              </Text>
              <Text style={styles.signName}>{ZODIAC[sign].label}</Text>
              <Text style={styles.stageLine}>{stage.line}</Text>

              {/* 6 regiones — tocá una para conocer qué despierta en ti. */}
              <View style={styles.regionList}>
                {progress.regions.map((r) => {
                  const def = config.regions.find((d) => d.key === r.key)
                  const open = focused === r.key
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setFocused((f) => (f === r.key ? null : r.key))}
                      style={[styles.regionRow, open && styles.regionRowOpen]}
                    >
                      <View style={styles.regionHead}>
                        <View style={[styles.regionIcon, { opacity: 0.3 + 0.7 * (r.pct / 100) }]}>
                          <RegionIcon region={r.key} size={22} color={colors.oro} />
                        </View>
                        <View style={styles.regionText}>
                          <Text style={styles.regionName}>{r.label}</Text>
                          <Text style={styles.regionMeaning} numberOfLines={open ? undefined : 1}>
                            {r.meaning}
                          </Text>
                          <View style={styles.bar}>
                            <View style={[styles.barFill, { width: `${r.pct}%` }]} />
                          </View>
                        </View>
                        <View style={styles.regionRight}>
                          <Text style={styles.regionPct}>{r.pct}%</Text>
                          <Text style={styles.regionLevel}>{AWAKENING_LABEL[r.level]}</Text>
                        </View>
                      </View>

                      {open && def ? (
                        <Animated.View entering={FadeIn.duration(220)} style={styles.detail}>
                          <View style={styles.detailDivider} />
                          {r.pct >= 100 ? (
                            <Text style={styles.revelationLine}>{def.revelation.line}</Text>
                          ) : (
                            <Text style={styles.detailHint}>
                              Despierta con tu {SOURCE_ACTION[r.source].toLowerCase()}.
                            </Text>
                          )}
                        </Animated.View>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </>
          ) : (
            <Text style={styles.empty}>
              Completá tu fecha de nacimiento para descubrir tu Alma Celeste.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  soul: { marginTop: 8 },
  stageEyebrow: {
    marginTop: 14,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    color: colors.oro,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  signName: {
    fontFamily: typography.displayHeavy,
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.leche,
    textAlign: 'center',
    marginTop: 4,
  },
  stageLine: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontSize: typography.sizes.title,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  regionList: { marginTop: 22, gap: 8 },
  regionRow: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
  },
  regionRowOpen: { borderColor: colors.oro },
  regionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  regionIcon: { width: 24, alignItems: 'center', justifyContent: 'center' },
  regionText: { flex: 1, minWidth: 0, gap: 3 },
  regionName: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  regionMeaning: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  bar: {
    marginTop: 3,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.oroHairlineSoft,
    overflow: 'hidden',
  },
  barFill: { height: 2, borderRadius: 2, backgroundColor: colors.oro },
  regionRight: { alignItems: 'flex-end' },
  regionPct: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  regionLevel: { fontFamily: typography.ui, fontSize: typography.sizes.micro, color: colors.oro },
  detail: { marginTop: 10 },
  detailDivider: { height: 1, backgroundColor: colors.oroHairlineSoft, marginBottom: 10 },
  revelationLine: {
    fontFamily: typography.serif,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oro,
  },
  detailHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.caption,
    color: colors.bone,
  },
  empty: {
    marginTop: 80,
    fontFamily: typography.serif,
    fontSize: typography.sizes.title,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
})
