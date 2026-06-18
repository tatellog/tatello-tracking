import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DevBackButton } from '@/components/DevBackButton'
import { withDevGuard } from '@/components/withDevGuard'
import {
  AWAKENING_LABEL,
  computeSoulProgress,
  soulConfigForSign,
  SOURCE_ACTION,
  SoulMoment,
  SoulStageReveal,
} from '@/features/celestial-soul'
import { CelestialSoulView } from '@/features/celestial-soul/components/CelestialSoulView'
import { RegionIcon } from '@/features/celestial-soul/components/RegionIcon'
import { nextNodeForSource, stageForPct } from '@/features/celestial-soul/logic'
import type { RevealSource } from '@/features/celestial-soul/types'
import { SkyBackground } from '@/features/tabs/components'
import { ZODIAC } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { colors, typography } from '@/theme'

const SIGNS = Object.keys(ZODIAC) as ZodiacSign[]
const SOURCES = Object.keys(SOURCE_ACTION) as RevealSource[]

function DevCelestialSoulScreen() {
  const [sign, setSign] = useState<ZodiacSign>('leo')
  const [revealed, setRevealed] = useState<string[]>([])
  const [stageRevealOpen, setStageRevealOpen] = useState(false)
  const [momentPreview, setMomentPreview] = useState<'region' | 'final' | null>(null)

  const config = useMemo(() => soulConfigForSign(sign), [sign])
  const progress = useMemo(() => computeSoulProgress(config, new Set(revealed)), [config, revealed])
  const stage = stageForPct(progress.pct)

  const revealNext = (source: RevealSource) => {
    const node = nextNodeForSource(config, source, new Set(revealed))
    if (node) setRevealed((r) => [...r, node.id])
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DevBackButton />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Alma Celeste · preview</Text>

          <View style={styles.chips}>
            {SIGNS.map((s) => {
              const active = s === sign
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    setSign(s)
                    setRevealed([])
                  }}
                  style={[styles.chip, active && styles.chipOn]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextOn]}>
                    {ZODIAC[s].label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.heroLabel}>Tu Alma Celeste</Text>
          <CelestialSoulView sign={sign} revealedIds={revealed} style={styles.soul} />
          <Text style={styles.totalPct}>
            {progress.fullyAwake ? 'Despierta por completo' : `${progress.pct}% despierta`}
          </Text>

          {/* Lista de 6 regiones (vive fuera del hero · aquí para inspección). */}
          <View style={styles.regionList}>
            {progress.regions.map((r) => (
              <View key={r.key} style={styles.regionRow}>
                <View style={[styles.regionIcon, { opacity: 0.3 + 0.7 * (r.pct / 100) }]}>
                  <RegionIcon region={r.key} size={22} color={colors.oro} />
                </View>
                <View style={styles.regionText}>
                  <Text style={styles.regionName}>{r.label}</Text>
                  <Text style={styles.regionMeaning} numberOfLines={1}>
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
            ))}
          </View>

          {/* Controles dev — simulan acciones que revelan nodos. */}
          <Text style={styles.label}>Revelar (simula una acción)</Text>
          <View style={styles.chips}>
            {SOURCES.map((src) => {
              const exhausted = !nextNodeForSource(config, src, new Set(revealed))
              return (
                <Pressable
                  key={src}
                  onPress={() => revealNext(src)}
                  disabled={exhausted}
                  style={[styles.srcBtn, exhausted && styles.srcBtnOff]}
                >
                  <Text style={styles.srcText}>{SOURCE_ACTION[src]}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.row}>
            <Pressable
              onPress={() => setRevealed(config.nodes.map((n) => n.id))}
              style={[styles.bigBtn, styles.bigBtnGold]}
            >
              <Text style={styles.bigBtnGoldText}>Revelar todo</Text>
            </Pressable>
            <Pressable onPress={() => setRevealed([])} style={[styles.bigBtn, styles.bigBtnGhost]}>
              <Text style={styles.bigBtnGhostText}>Reiniciar</Text>
            </Pressable>
          </View>

          {/* Previsualiza los momentos de revelación. */}
          <Pressable
            onPress={() => setStageRevealOpen(true)}
            style={[styles.bigBtn, styles.bigBtnGhost, { marginTop: 10 }]}
          >
            <Text style={styles.bigBtnGhostText}>Ver etapa · {stage.name}</Text>
          </Pressable>
          <View style={styles.row}>
            <Pressable
              onPress={() => setMomentPreview('region')}
              style={[styles.bigBtn, styles.bigBtnGhost]}
            >
              <Text style={styles.bigBtnGhostText}>Ver región</Text>
            </Pressable>
            <Pressable
              onPress={() => setMomentPreview('final')}
              style={[styles.bigBtn, styles.bigBtnGhost]}
            >
              <Text style={styles.bigBtnGhostText}>Ver final</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      {stageRevealOpen ? (
        <SoulStageReveal
          sign={sign}
          revealedIds={revealed}
          stage={stage}
          onClose={() => setStageRevealOpen(false)}
        />
      ) : null}

      {momentPreview === 'region' ? (
        <SoulMoment
          sign={sign}
          revealedIds={revealed}
          icon={<RegionIcon region={config.regions[0]!.key} size={30} color={colors.oro} />}
          eyebrow={config.regions[0]!.label.toUpperCase()}
          line={config.regions[0]!.revelation.line}
          onClose={() => setMomentPreview(null)}
        />
      ) : null}

      {momentPreview === 'final' ? (
        <SoulMoment
          sign={sign}
          revealedIds={revealed}
          eyebrow="TU ALMA CELESTE"
          line="Ha despertado."
          onClose={() => setMomentPreview(null)}
        />
      ) : null}
    </View>
  )
}

export default withDevGuard(DevCelestialSoulScreen)

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  title: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.title,
    color: colors.leche,
    marginTop: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgCard,
  },
  chipOn: { borderColor: colors.oro, backgroundColor: colors.oroTint },
  chipText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.bone,
  },
  chipTextOn: { color: colors.leche },
  soul: { marginTop: 8 },
  heroLabel: {
    fontFamily: typography.displayHeavy,
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.leche,
    textAlign: 'center',
    marginTop: 6,
  },
  totalPct: {
    marginTop: 8,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oro,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  regionList: { marginTop: 14, gap: 8 },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
  },
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
  label: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 8,
  },
  srcBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.oroTint,
  },
  srcBtnOff: { opacity: 0.35 },
  srcText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.bone,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  bigBtn: { flex: 1, borderRadius: 100, paddingVertical: 13, alignItems: 'center' },
  bigBtnGold: { backgroundColor: colors.oro },
  bigBtnGoldText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.bg,
  },
  bigBtnGhost: { borderWidth: 1, borderColor: colors.hairline },
  bigBtnGhostText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
