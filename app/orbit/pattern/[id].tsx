import { useLocalSearchParams, useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useMacroTargets } from '@/features/macros/hooks'
import { StelarVoice } from '@/features/orbit/components/StelarVoice'
import { useHistoryMeals, useSignalsHistory } from '@/features/orbit/hooks'
import type { CycleData, PairedData, Patron, WeekdayData } from '@/features/orbit/mock'
import { detectHabitPatterns } from '@/features/orbit/habit-patterns'
import { detectMonthPatterns } from '@/features/orbit/month-patterns'
import { detectNightPattern } from '@/features/orbit/night-pattern'
import { detectWeekPatterns } from '@/features/orbit/week-patterns'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

export default function PatronDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: history } = useSignalsHistory()
  const { data: histMeals } = useHistoryMeals()
  const macros = useMacroTargets()
  const dimCtx = {
    calorieTarget: macros.data?.calories ?? null,
    proteinTarget: macros.data?.protein_g ?? null,
  }
  const detected = history
    ? [
        ...detectWeekPatterns(history, dimCtx),
        ...detectHabitPatterns(history),
        ...detectMonthPatterns(history, dimCtx),
      ]
    : []
  const night = histMeals ? detectNightPattern(histMeals) : null
  const patron = (night && night.id === id ? night : undefined) ?? detected.find((p) => p.id === id)

  const accent = colors.magenta

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

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BackButton onPress={() => router.back()} />

          {/* The reading, restated as the hero. The "detected since"
              + confidence stars are Stelar's signature, no clinical
              "PATRÓN DETECTADO" eyebrow (the title already says it). */}
          <Animated.View entering={FadeInDown.duration(360)}>
            <EmText
              text={patron.title}
              emphasis={patron.emphasis}
              style={styles.heroTitle}
              emStyle={[styles.heroEm, { color: accent }]}
            />
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{patron.since}</Text>
              <Text style={styles.metaDivider}> · </Text>
              <Text style={styles.metaLabel}>confianza</Text>
              <View style={styles.confidenceStars}>
                <ConfidenceStars level={patron.confidence} />
              </View>
            </View>
          </Animated.View>

          {/* 1 · The evidence — the recurrence drawn as a constellation. */}
          <Section title="La evidencia">
            <Evidence patron={patron} accent={accent} />
            <Text style={styles.legend}>{patron.legend}</Text>
          </Section>

          {/* 2 · The why — coach voice, systemic not moral. Oro: this is
              the observatory reading, not the dimension itself talking. It
              closes the screen: Stelar shows the recurrence and reads it,
              without inventing a cause or pushing an action. */}
          <StelarVoice scope="este patrón" text={patron.voz} accent={colors.oro} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
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
function Evidence({ patron, accent }: { patron: Patron; accent: string }) {
  switch (patron.data.kind) {
    case 'weekday':
      return <WeekdayConstellation data={patron.data} accent={accent} />
    case 'cycle':
      return <CycleEvidence data={patron.data} accent={accent} />
    case 'paired':
      return <PairedEvidence data={patron.data} accent={accent} />
  }
}

/* Multi-week evidence as a constellation: the focus day lit row after
 * row, threaded by a vertical oro axis. Magnitude (0..1) rides in the
 * radius of the focus halo, not in bar height. The recurrence is read
 * as a column of light, not a stack of bars. */
function WeekdayConstellation({ data, accent }: { data: WeekdayData; accent: string }) {
  const ROW_H = 34,
    LEFT = 44,
    TOP = 18,
    W = 320
  const COL_GAP = (W - LEFT - 12) / 6
  const H = data.weeks.length * ROW_H + TOP + 22
  const cx = (j: number) => LEFT + j * COL_GAP
  const cy = (i: number) => TOP + i * ROW_H + ROW_H / 2
  const axisX = cx(data.focus)
  return (
    <View style={styles.chartCard}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path
          d={`M${axisX} ${cy(0)} L${axisX} ${cy(data.weeks.length - 1)}`}
          stroke={colors.oroHairline}
          strokeWidth={1}
        />
        {data.weeks.map((w, i) => (
          <G key={`r-${i}`}>
            <SvgText
              x={8}
              y={cy(i) + 3.5}
              fontFamily={typography.uiBold}
              fontSize={9.5}
              letterSpacing={1}
              fill={colors.niebla}
            >
              {w.label.toUpperCase()}
            </SvgText>
            {w.bars.map((v, j) =>
              j === data.focus ? (
                <G key={`c-${j}`}>
                  <Circle cx={cx(j)} cy={cy(i)} r={6 + v * 5} fill={accent} opacity={0.14} />
                  <Circle cx={cx(j)} cy={cy(i)} r={4.5} fill={accent} />
                </G>
              ) : (
                <Circle
                  key={`c-${j}`}
                  cx={cx(j)}
                  cy={cy(i)}
                  r={2.5}
                  fill={colors.bruma}
                  opacity={0.5}
                />
              ),
            )}
          </G>
        ))}
        {WEEK_LABELS.map((lbl, j) => (
          <SvgText
            key={`l-${j}`}
            x={cx(j)}
            y={H - 4}
            textAnchor="middle"
            fontFamily={typography.uiBold}
            fontSize={11}
            fill={j === data.focus ? accent : colors.niebla}
            opacity={j === data.focus ? 1 : 0.7}
          >
            {lbl}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
}

/* Confianza como 3 puntos de luz: lleno=alcanzado (oro), anillo=aún no. */
function ConfidenceStars({ level }: { level: 'alta' | 'media' | 'baja' }) {
  const filled = level === 'alta' ? 3 : level === 'media' ? 2 : 1
  return (
    <Svg width={42} height={10} viewBox="0 0 42 10">
      {[0, 1, 2].map((i) => {
        const cx = 5 + i * 16
        return i < filled ? (
          <Circle key={i} cx={cx} cy={5} r={2.4} fill={colors.oro} />
        ) : (
          <Circle
            key={i}
            cx={cx}
            cy={5}
            r={2.2}
            fill="none"
            stroke={colors.oro}
            strokeWidth={1}
            opacity={0.5}
          />
        )
      })}
    </Svg>
  )
}

/* Cycle evidence — 28 dots across the cycle, the band lit and the
 * marked day called out. The eye scans it like a clock arc. */
function CycleEvidence({ data, accent }: { data: CycleData; accent: string }) {
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
              fill={inBand ? accent : colors.bruma}
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
                stroke={accent}
                strokeWidth={1.2}
                opacity={0.8}
              />
              <SvgText
                x={cx}
                y={cy - 14}
                textAnchor="middle"
                fontFamily={typography.uiBold}
                fontSize={10}
                fill={accent}
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
function PairedEvidence({ data, accent }: { data: PairedData; accent: string }) {
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
              fill={highlight ? accent : colors.bruma}
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
              fill={highlight ? accent : colors.bone}
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
              fill={highlight ? accent : colors.niebla}
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
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  // Hero — the reading restated, big.
  heroTitle: {
    marginTop: 4,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.deltaNum,
    lineHeight: 34,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  heroEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.macroNum,
    color: colors.magenta,
  },
  // Meta row — "detected since · confianza ●●○" with oro stars.
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  meta: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  metaDivider: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  metaLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  confidenceStars: {
    marginLeft: 8,
    justifyContent: 'center',
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
    borderColor: colors.oroHairline,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  // ── Legend under the evidence chart ─────────────────────────
  legend: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.niebla,
  },
})
