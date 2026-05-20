import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg'
import Toast from 'react-native-toast-message'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { PrimaryCta } from '@/components/PrimaryCta'
import { VozDeStelar } from '@/features/orbita/components/VozDeStelar'
import {
  MOCK_PATRONES,
  type CycleData,
  type PairedData,
  type Patron,
  type WeekdayData,
} from '@/features/orbita/mock'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Pattern detail — what a "Patrones detectados" card opens. A pattern
 * is a detected órbita, so this screen does four things: proves it
 * (the evidence, shaped by the pattern's kind — multi-week, cycle,
 * paired), explains it (Voz de Stelar — systemic, never moral),
 * connects it (the correlation), and turns it into a system (an
 * experiment STELAR will track). Content is MOCK.
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

          {/* The reading, restated as the hero. The "detected since"
              + confidence dots are Stelar's signature, no clinical
              "PATRÓN DETECTADO" eyebrow (the title already says it). */}
          <Animated.View entering={FadeInDown.duration(360)}>
            <EmText
              text={patron.title}
              emphasis={patron.emphasis}
              style={styles.heroTitle}
              emStyle={styles.heroEm}
            />
            <Text style={styles.meta}>
              {patron.since}
              {'   ·   '}
              <Text style={styles.metaLabel}>confianza </Text>
              <Text style={styles.confidenceDots}>{CONFIDENCE_DOTS[patron.confidence]}</Text>
            </Text>
          </Animated.View>

          {/* 1 · The evidence — shape depends on the pattern's data. */}
          <Section title="La evidencia">
            <Evidence patron={patron} />
            <Text style={styles.caption}>{patron.caption}</Text>
            <Text style={styles.legend}>{patron.legend}</Text>
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

const CONFIDENCE_DOTS: Record<Patron['confidence'], string> = {
  alta: '● ● ●',
  media: '● ● ○',
  baja: '● ○ ○',
}

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

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

/* The evidence — picks the visual the pattern's shape calls for. */
function Evidence({ patron }: { patron: Patron }) {
  switch (patron.data.kind) {
    case 'weekday':
      return <WeekdayEvidence data={patron.data} />
    case 'cycle':
      return <CycleEvidence data={patron.data} />
    case 'paired':
      return <PairedEvidence data={patron.data} />
  }
}

/* Multi-week evidence — stacks the recent weeks so the focus day
 * is seen falling (or peaking) week after week. The recurrence is
 * literally drawn, not described. */
function WeekdayEvidence({ data }: { data: WeekdayData }) {
  const ROW_H = 30
  return (
    <View style={styles.chartCard}>
      {data.weeks.map((w, i) => (
        <View key={i} style={[styles.weekRow, { height: ROW_H }]}>
          <Text style={styles.weekRowLabel}>{w.label}</Text>
          <View style={styles.weekBars}>
            {w.bars.map((v, j) => (
              <View key={j} style={styles.weekBarCol}>
                <View
                  style={[
                    styles.weekBarFill,
                    {
                      height: `${Math.max(8, v * 100)}%`,
                      backgroundColor: j === data.focus ? colors.magenta : colors.bruma,
                      opacity: j === data.focus ? 1 : 0.65,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      {/* Day letters — shown once, beneath the last week. */}
      <View style={styles.weekLabelsRow}>
        <View style={styles.weekRowLabelSpacer} />
        <View style={styles.weekBars}>
          {WEEK_LABELS.map((lbl, j) => (
            <Text key={j} style={[styles.dayLabel, j === data.focus ? styles.dayLabelFocus : null]}>
              {lbl}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}

/* Cycle evidence — 28 dots across the cycle, the band lit and the
 * marked day called out. The eye scans it like a clock arc. */
function CycleEvidence({ data }: { data: CycleData }) {
  const W = 320
  const H = 90
  const pad = 12
  const span = W - 2 * pad
  const step = span / (data.length - 1)
  const cy = 40
  const [bandStart, bandEnd] = data.band

  return (
    <View style={styles.chartCard}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {data.bars.map((_, i) => {
          const day = i + 1
          const inBand = day >= bandStart && day <= bandEnd
          const isMark = day === data.markDay
          const cx = pad + i * step
          return (
            <Circle
              key={`d-${i}`}
              cx={cx}
              cy={cy}
              r={isMark ? 4 : 3}
              fill={inBand ? colors.magenta : colors.bruma}
              opacity={inBand ? (isMark ? 1 : 0.85) : 0.55}
            />
          )
        })}
        {/* The marked day — a small ring + day number above. */}
        {(() => {
          const cx = pad + (data.markDay - 1) * step
          return (
            <>
              <Circle
                cx={cx}
                cy={cy}
                r={9}
                fill="none"
                stroke={colors.magenta}
                strokeWidth={1.2}
                opacity={0.8}
              />
              <SvgText
                x={cx}
                y={cy - 14}
                textAnchor="middle"
                fontFamily={typography.uiBold}
                fontSize={10}
                fill={colors.magenta}
              >
                día {data.markDay}
              </SvgText>
            </>
          )
        })()}
        {/* Axis ticks every 7 days. */}
        {[1, 7, 14, 21, 28].map((d) => {
          const cx = pad + (d - 1) * step
          return (
            <SvgText
              key={`ax-${d}`}
              x={cx}
              y={H - 8}
              textAnchor="middle"
              fontFamily={typography.uiBold}
              fontSize={9}
              fill={colors.niebla}
              opacity={0.7}
            >
              {d}
            </SvgText>
          )
        })}
      </Svg>
    </View>
  )
}

/* Paired evidence — two bars side by side, each labelled with its
 * average. The visual contrast IS the pattern. */
function PairedEvidence({ data }: { data: PairedData }) {
  const W = 320
  const H = 130
  const BAR_W = 70
  const GAP = 36
  const TOTAL = BAR_W * data.groups.length + GAP * (data.groups.length - 1)
  const startX = (W - TOTAL) / 2
  const MAX_BAR = 70
  const maxAvg = Math.max(...data.groups.map((g) => g.avg))
  return (
    <View style={styles.chartCard}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {data.groups.map((g, i) => {
          const x = startX + i * (BAR_W + GAP)
          const h = (g.avg / maxAvg) * MAX_BAR
          const highlight = i === 0
          const top = H - 30 - h
          return (
            <Rect
              key={`bar-${i}`}
              x={x}
              y={top}
              width={BAR_W}
              height={h}
              rx={6}
              fill={highlight ? colors.magenta : colors.bruma}
              opacity={highlight ? 1 : 0.85}
            />
          )
        })}
        {data.groups.map((g, i) => {
          const x = startX + i * (BAR_W + GAP) + BAR_W / 2
          const h = (g.avg / maxAvg) * MAX_BAR
          const top = H - 30 - h - 8
          const highlight = i === 0
          return (
            <SvgText
              key={`v-${i}`}
              x={x}
              y={top}
              textAnchor="middle"
              fontFamily={typography.uiBold}
              fontSize={15}
              fill={highlight ? colors.magenta : colors.bone}
            >
              {g.avg}
              {g.unit}
            </SvgText>
          )
        })}
        {data.groups.map((g, i) => {
          const x = startX + i * (BAR_W + GAP) + BAR_W / 2
          const highlight = i === 0
          return (
            <SvgText
              key={`l-${i}`}
              x={x}
              y={H - 8}
              textAnchor="middle"
              fontFamily={typography.uiBold}
              fontSize={10}
              letterSpacing={1}
              fill={highlight ? colors.magenta : colors.niebla}
            >
              {g.label}
            </SvgText>
          )
        })}
      </Svg>
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
  // Hero — the reading restated, big.
  heroTitle: {
    marginTop: 4,
    fontFamily: typography.displaySemi,
    fontSize: 28,
    lineHeight: 34,
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
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: 11.5,
    color: colors.niebla,
  },
  metaLabel: {
    color: colors.niebla,
  },
  // The confidence dots — magenta, slightly larger than the meta text.
  confidenceDots: {
    color: colors.magenta,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  section: {
    marginTop: 26,
  },
  sectionBody: {
    marginTop: 12,
  },
  // ── Evidence chart card ──────────────────────────────────────
  chartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  // ── Multi-week (weekday) layout ─────────────────────────────
  weekRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  weekRowLabel: {
    width: 40,
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.niebla,
    textTransform: 'uppercase',
  },
  weekRowLabelSpacer: {
    width: 40,
  },
  weekBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 4,
  },
  weekBarCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  weekBarFill: {
    width: '100%',
    borderRadius: 3,
    minHeight: 3,
  },
  weekLabelsRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.niebla,
  },
  dayLabelFocus: {
    color: colors.magenta,
  },
  // ── Caption + legend under the evidence chart ───────────────
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
