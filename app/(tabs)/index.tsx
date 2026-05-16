import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { BriefContext } from '@/features/brief/api'
import { Day1Celebration, HomeError, HomeSkeleton } from '@/features/home/components'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import { useProfile } from '@/features/profile/hooks'
import { useToggleWorkoutForDate, useToggleWorkoutToday } from '@/features/streak/hooks'
import {
  LunarConstellation,
  SectionHeader,
  StatSlider,
  TabHeader,
  TodayMealLog,
  TodayWorkoutButton,
  WeekStrip,
  type WeekDayCell,
} from '@/features/tabs/components'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

const CELEBRATION_MS = 2000

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
  const brief = useHomeBrief()
  const cadence = useHomeCadence()
  useDayRollover(brief.data?.date)

  if (brief.isError && !brief.data) return <HomeError onRetry={brief.refetch} />

  if (brief.isLoading || !brief.data || cadence == null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return <TodayContent ctx={brief.data} cadence={cadence} />
}

type ContentProps = { ctx: BriefContext; cadence: Cadence }

function TodayContent({ ctx, cadence }: ContentProps) {
  const qc = useQueryClient()
  const router = useRouter()
  const { data: profile } = useProfile()

  const toggleToday = useToggleWorkoutToday()
  const toggleForDate = useToggleWorkoutForDate()

  const [showCelebration, setShowCelebration] = useState(false)
  const [justMarkedIdx, setJustMarkedIdx] = useState<number | null>(null)
  // Drives the full-viewport magenta wash that accompanies the
  // constellation burst on each day-mark. Fires 0→1 over the same
  // duration as LunarConstellation's internal radialPulse so the
  // two animations read as one moment. Bell-curve opacity in the
  // animated style peaks mid-pulse and fades back to zero at the end.
  const screenFlash = useSharedValue(0)
  const screenFlashStyle = useAnimatedStyle(() => {
    const u = screenFlash.value
    return { opacity: u * (1 - u) * 4 * 0.18 }
  })
  const todayIsoLocal = ctx.date

  // The week strip shows the full 28-day window as one horizontally
  // scrollable history — oldest day first, today last.
  const allDays: WeekDayCell[] = ctx.grid_28_days.map((cell) => ({
    date: cell.date,
    trained: cell.completed,
    dayNum: dayNumOf(cell.date),
    weekdayIdx: dayOfWeekOf(cell.date),
    isToday: cell.date === todayIsoLocal,
  }))

  const trainedThisMonth = ctx.grid_28_days.filter((c) => c.completed).length

  const sign = useMemo(() => zodiacFromDate(profile?.date_of_birth), [profile?.date_of_birth])
  const signLabel = ZODIAC[sign].label

  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const greetingName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  const handleConfirmWorkout = () => {
    const wasFirstDay = isFirstDay
    toggleToday.mutate(true)
    // Mirror duration & easing of LunarConstellation's internal
    // radialPulse so the screen wash + the constellation burst peak
    // and fade together.
    screenFlash.value = 0
    screenFlash.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) })
    if (wasFirstDay) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setShowCelebration(true)
      setTimeout(() => {
        setShowCelebration(false)
        qc.invalidateQueries({ queryKey: queryKeys.profile.all })
      }, CELEBRATION_MS)
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
    // Marking a past day fires the same celebration as today's
    // workout: the screen wash here + the constellation burst (which
    // re-animates on its own once the trained count rises). Undo
    // toggles stay silent — matching the constellation, which never
    // animates downward.
    if (willComplete) {
      screenFlash.value = 0
      screenFlash.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) })
    }
    toggleForDate.mutate({ date, complete: willComplete })
  }

  const enter = makeEnter(cadence)

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(40)}>
            <TabHeader greeting={`Hola, ${greetingName}.`} greetingEmphasis={greetingName} />
          </Animated.View>

          {/* CTA only — once the day is marked the button has no job
              left, so it unmounts. The workout is then confirmed by
              the constellation burst, the coach line and the filled
              HOY star in the WeekStrip; undo lives on that star. */}
          {!ctx.today_workout_completed ? (
            <Animated.View entering={enter(120)} exiting={FadeOut.duration(260)}>
              <TodayWorkoutButton onConfirm={handleConfirmWorkout} />
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(220)}>
            <SectionHeader label={`Tu ${capitalize(signLabel)}`} />
          </Animated.View>

          <Animated.View entering={enter(320)}>
            <LunarConstellation
              trained={ctx.grid_28_days.map((c) => c.completed)}
              todayIdx={27}
              sign={sign}
              committed={ctx.today_workout_completed}
            />
          </Animated.View>

          <Animated.View entering={enter(420)}>
            <CoachLine count={trainedThisMonth} signLabel={signLabel} />
          </Animated.View>

          <Animated.View entering={enter(520)}>
            <SectionHeader label="Tu mes" />
            <Text style={styles.weekHint}>Desliza y toca un día para registrarlo.</Text>
            <WeekStrip days={allDays} onToggle={handleToggleDay} justMarkedIdx={justMarkedIdx} />
          </Animated.View>

          <Animated.View entering={enter(600)}>
            <StatSlider ctx={ctx} />
          </Animated.View>

          <Animated.View entering={enter(740)}>
            <SectionHeader label="Comidas de hoy" />
          </Animated.View>
          <Animated.View entering={enter(800)}>
            <TodayMealLog date={ctx.date} onOpenMeal={(id) => router.push(`/meal/${id}`)} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <Animated.View pointerEvents="none" style={[styles.screenFlash, screenFlashStyle]} />

      {showCelebration ? <Day1Celebration /> : null}
    </View>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/* Editorial copy that follows the user through the 28-day cycle.
 * Specific milestone days (1, 7, 14, 21, 28) get unique sentences;
 * in-between days fall back to phase-level copy so the message
 * evolves with the user's progress without writing 29 distinct
 * lines. The constellation centre already shows the numeric count —
 * the copy here doesn't repeat it. Sentences are capitalised so the
 * voice reads mature/editorial rather than chat-style. */
type CoachCopy = { before: string; emphasis: string; after: string }

function getCoachCopy(count: number, signLabel: string): CoachCopy {
  const lower = signLabel.toLowerCase()

  // Specific milestone days — checked first so they override the
  // phase fallbacks below.
  if (count === 28) {
    return { before: `Completaste tu ${lower}. `, emphasis: 'Brillas', after: '.' }
  }
  if (count === 21) {
    return { before: 'Tres semanas. Estás ', emphasis: 'cerca', after: '.' }
  }
  if (count === 14) {
    return { before: 'La ', emphasis: 'mitad atrás', after: '. Sigue.' }
  }
  if (count === 7) {
    return { before: 'Una semana. Tu cuerpo lo ', emphasis: 'recuerda', after: '.' }
  }
  if (count === 1) {
    return {
      before: 'Hoy ',
      emphasis: 'empieza',
      after: ' algo. Tu cuerpo lo está registrando.',
    }
  }

  // Phase fallbacks for in-between days. Each block covers the days
  // *after* its milestone (e.g. 22..27 sit in the "closing stretch"
  // bucket because 21 was the last milestone).
  if (count >= 22) {
    return {
      before: '',
      emphasis: 'Recta final',
      after: '. El cielo casi se cierra.',
    }
  }
  if (count >= 15) {
    return {
      before: 'Pasaste la mitad. Esto ya es ',
      emphasis: 'tuyo',
      after: '.',
    }
  }
  if (count >= 8) {
    return {
      before: 'El cuerpo aprende cuando ',
      emphasis: 'insistes',
      after: '.',
    }
  }
  if (count >= 2) {
    return {
      before: 'Tu cuerpo lo está ',
      emphasis: 'registrando',
      after: '. Aunque no lo veas todavía.',
    }
  }
  return { before: `Tu ${lower} `, emphasis: 'te espera', after: '.' }
}

function CoachLine({ count, signLabel }: { count: number; signLabel: string }) {
  const copy = getCoachCopy(count, signLabel)
  return (
    <Text style={styles.coachLine}>
      {copy.before}
      <Text style={styles.coachLineEm}>{copy.emphasis}</Text>
      {copy.after}
    </Text>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Magenta wash fired on each workout commit. Covers the full
  // viewport (above the ScrollView so it includes the header bar and
  // tab bar) and lets taps pass through via pointerEvents="none".
  screenFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.magenta,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  coachLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 18,
    lineHeight: 26,
    color: colors.bone,
    textAlign: 'center',
    marginHorizontal: 16,
    marginTop: 4,
  },
  coachLineEm: {
    color: colors.magenta,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
  },
  weekHint: {
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.niebla,
    marginTop: -4,
    marginBottom: 4,
  },
})
