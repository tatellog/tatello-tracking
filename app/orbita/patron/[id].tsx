import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import Toast from 'react-native-toast-message'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
import { VozDeStelar } from '@/features/orbita/components/VozDeStelar'
import { MOCK_PATRONES, type EvidenceBar } from '@/features/orbita/mock'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Pattern detail — what a "Patrones detectados" card opens. A pattern
 * is a detected órbita, so this screen does four things: proves it
 * (the evidence chart), explains it (Voz de Stelar — systemic, never
 * moral), connects it (the correlation that drives it) and turns it
 * into a system (an experiment STELAR will track). Content is MOCK
 * — see features/orbita/mock.ts — until the engine lands.
 */
export default function PatronDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const patron = MOCK_PATRONES.find((p) => p.id === id)

  if (!patron) {
    return (
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.center}>
            <Text style={styles.missing}>No encontramos ese patrón.</Text>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const activate = () => {
    Toast.show({
      type: 'success',
      text1: 'Experimento activado',
      text2: `STELAR seguirá «${patron.title.replace(/\.$/, '')}» y te avisará.`,
    })
    router.back()
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BackButton onPress={() => router.back()} />

          {/* The reading, restated as the hero. */}
          <Animated.View entering={FadeInDown.duration(360)}>
            <EyebrowLabel tone="magenta" size={10}>
              Patrón detectado
            </EyebrowLabel>
            <EmText
              text={patron.title}
              emphasis={patron.emphasis}
              style={styles.heroTitle}
              emStyle={styles.heroEm}
            />
            <Text style={styles.meta}>
              {patron.since}
              {'   ·   '}
              <Text style={styles.metaStrong}>Confianza {patron.confidence}</Text>
            </Text>
          </Animated.View>

          {/* 1 · The evidence — the chart that makes it a pattern. */}
          <Section title="La evidencia">
            <EvidenceChart bars={patron.evidence.bars} />
            <Text style={styles.caption}>{patron.evidence.caption}</Text>
            <Text style={styles.legend}>{patron.evidence.legend}</Text>
          </Section>

          {/* 2 · The why — coach voice, systemic not moral. */}
          <VozDeStelar scope="este patrón" text={patron.voz} />

          {/* 3 · The correlation — what moves it. */}
          <Section title="Qué lo mueve">
            <Text style={styles.body}>{patron.correlacion}</Text>
          </Section>

          {/* 4 · The lever — the pattern becomes a system. */}
          <Section title="El experimento">
            <Text style={styles.body}>{patron.experimento.hint}</Text>
            <PrimaryCta
              label={patron.experimento.action}
              onPress={activate}
              marginTop={16}
              accessibilityLabel={`Activar: ${patron.experimento.action}`}
            />
          </Section>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      style={styles.back}
      accessibilityRole="button"
      accessibilityLabel="Volver"
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M14 5 L7 12 L14 19"
          stroke={colors.bone}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  )
}

/* A labelled block — eyebrow over content, the screen's rhythm unit. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <EyebrowLabel tone="niebla" size={10}>
        {title}
      </EyebrowLabel>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

/* The evidence chart — one bar per data point. Marked bars (the days
 * the pattern is about) burn magenta; the rest stay dim. Works for a
 * 7-day week, a run of weeks or a 28-day cycle alike. */
function EvidenceChart({ bars }: { bars: readonly EvidenceBar[] }) {
  const hasLabels = bars.some((b) => b.label)
  return (
    <View>
      <View style={styles.chart}>
        {bars.map((b, i) => (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${Math.max(3, b.v * 100)}%`,
                    backgroundColor: b.mark ? colors.magenta : colors.bruma,
                  },
                ]}
              />
            </View>
            {hasLabels ? (
              <Text style={[styles.barLabel, b.mark && styles.barLabelMark]}>{b.label ?? ''}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 64,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.niebla,
  },
  // Hero — the reading restated.
  heroTitle: {
    marginTop: 10,
    fontFamily: typography.displaySemi,
    fontSize: 27,
    lineHeight: 33,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  heroEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 30,
    color: colors.magenta,
  },
  meta: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 11.5,
    color: colors.niebla,
  },
  metaStrong: {
    fontFamily: typography.uiBold,
    color: colors.bone,
  },
  section: {
    marginTop: 26,
  },
  sectionBody: {
    marginTop: 12,
  },
  // Evidence chart.
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 116,
    gap: 3,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 3,
  },
  barLabel: {
    marginTop: 7,
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: colors.niebla,
  },
  barLabelMark: {
    color: colors.magenta,
  },
  caption: {
    marginTop: 12,
    fontFamily: typography.uiSemi,
    fontSize: 13,
    color: colors.bone,
  },
  legend: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.niebla,
  },
  body: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    lineHeight: 21,
    color: colors.bone,
  },
})
