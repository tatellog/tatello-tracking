import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import LottieView from 'lottie-react-native'
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LoadingView } from '@/components/LoadingView'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { BriefContext } from '@/features/brief/api'
import { CelebrateShockwave, HomeError } from '@/features/home/components'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import type { Profile } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { PatternReveal, usePatternDetection } from '@/features/patterns'
import { useMonthWorkoutDates, useRecentWorkoutDates } from '@/features/progress/hooks'
import { useRestToday, useSetRestToday } from '@/features/rest/hooks'
import { useToggleWorkoutForDate, useToggleWorkoutToday } from '@/features/streak/hooks'
import { track } from '@/lib/analytics'
import {
  CoachLine,
  DayCheckIn,
  type DayState,
  LunarConstellation,
  SectionHeader,
  SkyBackground,
  StatSlider,
  StreakLine,
  TabHeader,
  TodayMealLog,
  WeekStrip,
  type WeekDayCell,
} from '@/features/tabs/components'
import {
  buildMonthGrid,
  buildTrailingDays,
} from '@/features/tabs/components/constellation/data/month-grid'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

/*
 * The commit haptic — a designed two-beat "phrase", not a tick:
 *   trained  → Medium impact ("it clicked in") + a Success
 *              notification 90 ms later ("it landed, and it mattered")
 *   backfill → a single Medium impact (marking a past day is a solid
 *              confirmation, but not today's live ritual)
 *   rested   → a soft Light impact — rest is valid, but a Success
 *              cue would mis-signal it as a "win"
 * Owned here (the action handlers) rather than in DayCheckIn or the
 * constellation, so the body's reward fires with the user's choice.
 */
function playCommitHaptic(kind: 'trained' | 'backfill' | 'rested') {
  if (kind === 'rested') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    return
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  if (kind === 'trained') {
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }, 90)
  }
}

function makeEnter(cadence: Cadence) {
  if (cadence === 'reduced') return (_d: number) => FadeIn.duration(220)
  return (d: number) => FadeInDown.duration(380).delay(d).springify().damping(18)
}

// Local-zoned day-of-week from 'YYYY-MM-DD'. Avoids the UTC-midnight
// drift west of UTC that `new Date('YYYY-MM-DD')` introduces.
function dayOfWeekOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

function dayNumOf(iso: string): number {
  return Number(iso.split('-')[2]) || 1
}

export default function TodayScreen() {
  return (
    <ErrorBoundary screen="hoy">
      <TodayBody />
    </ErrorBoundary>
  )
}

function TodayBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'hoy' })
    }, []),
  )
  const brief = useHomeBrief()
  const cadence = useHomeCadence()
  // Profile is also gated here (used to be inside TodayContent).
  // If brief hits cache instantly but profile is still over-the-wire,
  // the header would briefly render with the fallback "tú" greeting
  // and then update to the real name mid-entering-animation —
  // causing a visible text overlap glitch. Gating both together
  // keeps the loading skeleton up until ALL the data the first
  // paint needs is settled.
  const profile = useProfile()
  useDayRollover(brief.data?.date)

  if (brief.isError && !brief.data) return <HomeError onRetry={brief.refetch} />

  if (brief.isLoading || !brief.data || cadence == null || profile.isLoading) {
    return (
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </View>
    )
  }

  return <TodayContent ctx={brief.data} cadence={cadence} profile={profile.data ?? null} />
}

type ContentProps = {
  ctx: BriefContext
  cadence: Cadence
  profile: Profile | null
}

function TodayContent({ ctx, cadence, profile }: ContentProps) {
  const qc = useQueryClient()
  const router = useRouter()
  const { pattern, dismiss: dismissPattern } = usePatternDetection()
  // The `slide` query param tells StatSlider which slide to land on.
  // Set by the Órbita focus CTA (DaySegment) so tapping "Marca tu
  // energía" lands the user directly on the wellbeing card instead
  // of at the top of Hoy.
  const { slide: slideParam } = useLocalSearchParams<{ slide?: string }>()

  const toggleToday = useToggleWorkoutToday()
  const toggleForDate = useToggleWorkoutForDate()

  const restQuery = useRestToday(ctx.date)
  const setRest = useSetRestToday(ctx.date)
  const restedToday = restQuery.data ?? false

  const reducedMotion = useReducedMotion()
  const [celebrateKey, setCelebrateKey] = useState(0)

  const [justMarkedIdx, setJustMarkedIdx] = useState<number | null>(null)
  const [weekOpen, setWeekOpen] = useState(false)
  const todayIsoLocal = ctx.date

  const monthWorkouts = useMonthWorkoutDates()
  const month = useMemo(() => {
    const m = buildMonthGrid(todayIsoLocal, monthWorkouts.data ?? [])
    if (ctx.today_workout_completed && m.todayIdx >= 0 && !m.grid[m.todayIdx]) {
      m.grid[m.todayIdx] = true
      m.cells[m.todayIdx]!.trained = true
      m.trainedThisMonth += 1
    }
    return m
  }, [todayIsoLocal, monthWorkouts.data, ctx.today_workout_completed])

  const stripWorkouts = useRecentWorkoutDates(45)
  const allDays: WeekDayCell[] = useMemo(() => {
    const cells = buildTrailingDays(todayIsoLocal, stripWorkouts.data ?? [], 30)
    return cells.map((cell) => ({
      date: cell.date,
      trained: cell.trained || (cell.isToday && ctx.today_workout_completed),
      dayNum: dayNumOf(cell.date),
      weekdayIdx: dayOfWeekOf(cell.date),
      isToday: cell.isToday,
    }))
  }, [todayIsoLocal, stripWorkouts.data, ctx.today_workout_completed])

  const trainedThisMonth = month.trainedThisMonth
  const MONTHS_ES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  const monthLabel = MONTHS_ES[Number(todayIsoLocal.slice(5, 7)) - 1] ?? 'Tu mes'

  const sign = useMemo(() => zodiacFromDate(profile?.date_of_birth), [profile?.date_of_birth])
  const signLabel = ZODIAC[sign].label
  const figureCount = ZODIAC[sign].stars.length + ZODIAC[sign].lines.length

  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const greetingName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  const dayState: DayState = ctx.today_workout_completed
    ? 'trained'
    : restedToday
      ? 'rested'
      : 'undecided'

  const handleDayChange = (next: DayState) => {
    if (next === 'trained') {
      const wasFirstDay = isFirstDay
      if (restedToday) setRest.mutate(false)
      toggleToday.mutate(true)
      playCommitHaptic('trained')
      setCelebrateKey((k) => k + 1)
      if (wasFirstDay) {
        qc.invalidateQueries({ queryKey: queryKeys.profile.all })
      }
    } else if (next === 'rested') {
      if (ctx.today_workout_completed) toggleToday.mutate(false)
      setRest.mutate(true)
      playCommitHaptic('rested')
    } else {
      // Cleared back to undecided — undo whichever was set.
      if (ctx.today_workout_completed) toggleToday.mutate(false)
      if (restedToday) setRest.mutate(false)
    }
  }

  const handleToggleDay = (date: string) => {
    const cell = ctx.grid_28_days.find((c) => c.date === date)
    if (!cell) return
    const willComplete = !cell.completed
    const idx = ctx.grid_28_days.findIndex((c) => c.date === date)
    if (idx >= 0) {
      setJustMarkedIdx(idx)
      setTimeout(() => setJustMarkedIdx(null), 800)
    }
    if (willComplete) {
      playCommitHaptic('backfill')
    }
    toggleForDate.mutate({ date, complete: willComplete })
  }

  const enter = makeEnter(cadence)

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(40)}>
            <TabHeader greeting={`Hola, ${greetingName}.`} greetingEmphasis={greetingName} />
          </Animated.View>

          <Animated.View entering={enter(120)}>
            <DayCheckIn state={dayState} onChange={handleDayChange} />
          </Animated.View>

          <Animated.View entering={enter(160)}>
            <StreakLine streak={ctx.streak_days} />
          </Animated.View>

          <Animated.View entering={enter(220)} style={styles.constellationHeader}>
            <Text style={styles.constellationHeaderText}>Tu {signLabel}</Text>
          </Animated.View>

          <Animated.View entering={enter(320)} style={styles.constellationWrap}>
            <LunarConstellation
              trained={month.grid}
              todayIdx={month.todayIdx}
              target={month.daysInMonth}
              sign={sign}
              committed={ctx.today_workout_completed}
              suppressBurst
            />

            {!reducedMotion && celebrateKey > 0 ? (
              <View pointerEvents="none" style={styles.celebration}>
                <LottieView
                  key={celebrateKey}
                  source={require('../../assets/lottie/gold-fireworks.json')}
                  autoPlay
                  loop={false}
                  speed={0.6}
                  resizeMode="contain"
                  style={styles.celebrationLottie}
                />
              </View>
            ) : null}
          </Animated.View>

          <Animated.View entering={enter(420)} style={styles.coachLineWrap}>
            <CoachLine
              align="center"
              {...getCoachCopy(trainedThisMonth, signLabel, dayState === 'trained', sign)}
            />
            {(() => {
              if (dayState !== 'trained') return null
              if (trainedThisMonth >= figureCount) {
                return (
                  <Text style={styles.tomorrowHint}>
                    Mañana sumas <Text style={styles.tomorrowHintEmphasis}>luz extra</Text>.
                  </Text>
                )
              }
              // Last star before the asterism is whole.
              if (trainedThisMonth + 1 >= figureCount) {
                return (
                  <Text style={styles.tomorrowHint}>
                    Mañana <Text style={styles.tomorrowHintEmphasis}>completas tu figura</Text>.
                  </Text>
                )
              }
              const next = pickStarForCount(sign, trainedThisMonth + 1)
              if (!next) return null
              return (
                <Text style={styles.tomorrowHint}>
                  Mañana: <Text style={styles.tomorrowHintEmphasis}>{next.name}</Text>, {next.role}
                </Text>
              )
            })()}
          </Animated.View>

          <Animated.View entering={enter(520)}>
            <Pressable
              onPress={() => setWeekOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: weekOpen }}
            >
              <SectionHeader
                label={monthLabel}
                meta={weekOpen ? 'Ocultar' : 'Ver detalle'}
                metaEmphasis={weekOpen ? 'Ocultar' : 'Ver detalle'}
              />
            </Pressable>
            {weekOpen ? (
              <Animated.View entering={FadeIn.duration(220)}>
                <Text style={styles.weekHint}>Desliza y toca un día para registrarlo.</Text>
                <WeekStrip
                  days={allDays}
                  onToggle={handleToggleDay}
                  justMarkedIdx={justMarkedIdx}
                />
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View entering={enter(600)}>
            <StatSlider ctx={ctx} targetSlide={slideParam ?? null} />
          </Animated.View>

          <Animated.View entering={enter(740)}>
            <SectionHeader label="Comidas de hoy" />
          </Animated.View>
          <Animated.View entering={enter(800)}>
            <TodayMealLog
              date={ctx.date}
              onOpenMeal={(id) => router.push({ pathname: '/scan-meal', params: { editId: id } })}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
      {/* Pre-mounted (no `celebrateKey > 0` gate) so the Skia Canvas
          + layout pass happen ONCE on first paint, not on every
          commit. Without pre-mount the wash fired visibly later than
          the Lottie particles. Inside, the wash is invisible until
          `celebrateKey` bumps and the timeline animates u → 1. */}
      {!reducedMotion ? <CelebrateShockwave celebrateKey={celebrateKey} /> : null}
      {/* The pattern reveal — Stelar's core moment, full-screen. Lives at
          the root (it's a Modal) so it floats over Hoy. */}
      <PatternReveal pattern={pattern} onClose={dismissPattern} />
    </View>
  )
}

type CoachCopy = { before: string; emphasis: string; after: string }

const COACH_PHASE_POOLS: { min: number; lines: CoachCopy[] }[] = [
  {
    min: 22,
    lines: [
      { before: '', emphasis: 'Recta final', after: '. El cielo casi se cierra.' },
      { before: 'Tu ', emphasis: 'constelación', after: ' casi está completa.' },
      { before: 'Faltan pocas estrellas para ', emphasis: 'cerrarla', after: '.' },
      { before: 'Tan cerca que ya casi lo ', emphasis: 'ves entero', after: '.' },
    ],
  },
  {
    min: 15,
    lines: [
      { before: 'Pasaste la mitad. Esto ya es ', emphasis: 'tuyo', after: '.' },
      { before: 'La segunda mitad pesa ', emphasis: 'menos', after: '. Lo notas.' },
      { before: 'Tu cielo está más ', emphasis: 'lleno que vacío', after: '.' },
      { before: 'Lo difícil ya ', emphasis: 'quedó atrás', after: '.' },
    ],
  },
  {
    min: 8,
    lines: [
      { before: 'El cuerpo aprende cuando ', emphasis: 'insistes', after: '.' },
      { before: 'Ya no es esfuerzo. Empieza a ser ', emphasis: 'tuyo', after: '.' },
      { before: 'La constancia se está volviendo ', emphasis: 'gravedad', after: '.' },
      { before: 'Tu órbita ya tiene ', emphasis: 'forma', after: '.' },
    ],
  },
  {
    min: 2,
    lines: [
      { before: 'Tu cuerpo lo está ', emphasis: 'registrando', after: '. Aunque no lo veas aún.' },
      { before: 'Dos, tres, cuatro… ', emphasis: 'un patrón', after: ' empieza a dibujarse.' },
      { before: 'Cada día suma una estrella a tu ', emphasis: 'cielo', after: '.' },
      { before: 'Todavía es frágil. Por eso ', emphasis: 'hoy importa', after: '.' },
    ],
  },
]

function pickStarForCount(sign: ZodiacSign, count: number): { name: string; role: string } | null {
  if (count <= 0) return null
  const named = ZODIAC[sign].stars.filter(
    (s): s is typeof s & { name: string; role: string } =>
      typeof s.name === 'string' && typeof s.role === 'string',
  )
  if (named.length === 0) return null
  const star = named[(count - 1) % named.length]!
  return { name: star.name, role: star.role }
}

function getCoachCopy(
  count: number,
  signLabel: string,
  trainedToday: boolean,
  sign: ZodiacSign,
): CoachCopy {
  const lower = signLabel.toLowerCase()

  if (count === 28) {
    return { before: `Completaste tu ${lower}. `, emphasis: 'Brillas', after: '.' }
  }
  if (count === 21) {
    return { before: 'Tres semanas. Estás ', emphasis: 'cerca', after: '.' }
  }
  if (count === 14) {
    return { before: 'La ', emphasis: 'mitad atrás', after: '. Sigue.' }
  }
  if (count === 10) {
    return { before: 'Diez. Ya no es casualidad, es ', emphasis: 'tuyo', after: '.' }
  }
  if (count === 7) {
    return { before: 'Una semana. Tu cuerpo lo ', emphasis: 'recuerda', after: '.' }
  }
  if (count === 5) {
    return { before: 'Cinco días. Esto ya ', emphasis: 'pesa', after: '.' }
  }
  if (count === 2) {
    return { before: 'Dos. Ya empieza a ser un ', emphasis: 'patrón', after: '.' }
  }
  if (count === 1) {
    return { before: 'Hoy ', emphasis: 'empieza', after: ' algo. Tu cuerpo lo registra.' }
  }

  if (trainedToday) {
    const namedStar = pickStarForCount(sign, count)
    if (namedStar) {
      return {
        before: `Hoy encendiste ${namedStar.name}. `,
        emphasis: namedStar.role,
        after: '.',
      }
    }
    const done: CoachCopy[] = [
      { before: 'Hoy quedó. Una estrella más en tu ', emphasis: lower, after: '.' },
      { before: 'Listo por hoy. Tu cielo ', emphasis: 'creció', after: '.' },
      { before: 'Hoy ', emphasis: 'cuenta', after: '. Tu cuerpo lo registró.' },
      { before: 'Quedó marcado. Una luz ', emphasis: 'más', after: ' en tu figura.' },
    ]
    return done[count % done.length]!
  }

  const phase = COACH_PHASE_POOLS.find((p) => count >= p.min)
  if (phase) {
    return phase.lines[count % phase.lines.length] ?? phase.lines[0]!
  }
  return { before: `Tu ${lower} `, emphasis: 'te espera', after: '.' }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  weekHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: -4,
    marginBottom: 4,
  },
  constellationHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  constellationWrap: {
    marginHorizontal: -20,
  },
  celebration: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationLottie: {
    width: '100%',
    height: '100%',
  },
  constellationHeaderText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 26,
    color: colors.leche,
    letterSpacing: 1.0,
  },
  coachLineWrap: {
    marginTop: 6,
    marginBottom: 14,
  },
  tomorrowHint: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  tomorrowHintEmphasis: {
    color: colors.bone,
  },
})
