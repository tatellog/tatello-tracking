import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useMacroTargets } from '@/features/macros/hooks'
import { StelarVoice } from '@/features/orbit/components/StelarVoice'
import { useWeekSignals } from '@/features/orbit/hooks'
import { buildWeekObservations, WEEKDAY_NAMES_FULL } from '@/features/orbit/week-logic'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function ObservationDetailScreen() {
  const router = useRouter()
  const { key } = useLocalSearchParams<{ key: string }>()
  const { data: weekSignals } = useWeekSignals()
  const macros = useMacroTargets()
  const todayIdx = useMemo(() => new Date().getDay(), [])
  const dimCtx = useMemo(
    () => ({
      calorieTarget: macros.data?.calories ?? null,
      proteinTarget: macros.data?.protein_g ?? null,
    }),
    [macros.data?.calories, macros.data?.protein_g],
  )
  const obs = useMemo(
    () => buildWeekObservations(weekSignals ?? [], todayIdx, dimCtx).find((o) => o.key === key),
    [weekSignals, todayIdx, dimCtx, key],
  )

  if (!obs) {
    return (
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <BackButton onPress={() => router.back()} />
          <View style={styles.center}>
            <Text style={styles.missing}>Esa observación ya no está en tu semana.</Text>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const accent = obs.state === 'win' ? colors.dimension[obs.dimension] : colors.oro

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <BackButton onPress={() => router.back()} />

          <EmText
            text={obs.title}
            emphasis={obs.emphasis}
            style={styles.heroTitle}
            emStyle={[styles.heroEm, { color: accent }]}
          />
          <Text style={styles.meta}>
            {obs.tag}
            {'   ·   '}
            <Text style={{ color: accent }}>
              {obs.days.length} {obs.days.length === 1 ? 'día' : 'días'}
            </Text>
          </Text>

          {/* The week, with the days the observation is about marked. */}
          <View style={styles.section}>
            <WeekMarks days={obs.days} accent={accent} />
          </View>

          {/* Los días — the real numbers behind it, day by day. */}
          <View style={styles.section}>
            <EyebrowLabel tone="niebla" size={10}>
              Los días
            </EyebrowLabel>
            <View style={styles.daysList}>
              {obs.entries.map((e) => (
                <View key={e.dayIdx} style={styles.dayRow}>
                  <Text style={styles.dayName}>{WEEKDAY_NAMES_FULL[e.dayIdx]}</Text>
                  <Text style={styles.dayValue}>{e.value}</Text>
                  {e.delta ? (
                    <Text style={[styles.dayDelta, { color: accent }]}>{e.delta}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {/* The why — coach voice, systemic not moral. */}
          <StelarVoice scope="esta semana" text={obs.voz} accent={colors.oro} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

/* Seven day-bars; the marked days burn in the accent color, the rest stay
 * quiet. `days` are Sunday-first (0=Sun); displayed Mon-first L M M J V S D. */
function WeekMarks({ days, accent }: { days: number[]; accent: string }) {
  const litMon = new Set(days.map((d) => (d + 6) % 7))
  const W = 320
  const H = 80
  const BAR_W = 26
  const GAP = (W - BAR_W * 7) / 6
  const MAX = 48
  return (
    <View style={styles.chartCard}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {WEEK_LABELS.map((_, i) => {
          const lit = litMon.has(i)
          const x = i * (BAR_W + GAP)
          const h = lit ? MAX : 12
          return (
            <Rect
              key={`b-${i}`}
              x={x}
              y={MAX - h + 4}
              width={BAR_W}
              height={h}
              rx={4}
              fill={lit ? accent : colors.bruma}
              opacity={lit ? 1 : 0.55}
            />
          )
        })}
        {WEEK_LABELS.map((lbl, i) => {
          const lit = litMon.has(i)
          const x = i * (BAR_W + GAP) + BAR_W / 2
          return (
            <SvgText
              key={`l-${i}`}
              x={x}
              y={H - 4}
              textAnchor="middle"
              fontFamily={typography.uiBold}
              fontSize={11}
              fill={lit ? accent : colors.niebla}
              opacity={lit ? 1 : 0.7}
            >
              {lbl}
            </SvgText>
          )
        })}
      </Svg>
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
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
  },
  meta: {
    marginTop: 12,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  section: {
    marginTop: 26,
  },
  chartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  daysList: {
    marginTop: 12,
    gap: 12,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  dayName: {
    width: 96,
    fontFamily: typography.uiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.leche,
  },
  dayValue: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  dayDelta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
  },
})
