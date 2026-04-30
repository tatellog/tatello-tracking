import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { BriefContext } from '@/features/brief/api'
import {
  AnchorLine,
  Day1Banner,
  Day1Celebration,
  DeltaPair,
  HomeError,
  HomeHeader,
  HomeSkeleton,
  MoodPicker,
  PhotoReminderBanner,
  QuickActions,
  StreakCard,
} from '@/features/home/components'
import {
  deriveAnchorAction,
  deriveDayState,
  deriveTodayTileCopy,
  deriveTodayTileState,
} from '@/features/home/logic'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import { DefineTargetsBanner, LogMealButton, MacrosTodayCard } from '@/features/macros/components'
import { useAddMoodCheckin } from '@/features/moods/hooks'
import { useLatestPhotoSet } from '@/features/onboarding/photos/hooks/useLatestPhotoSet'
import { useProfile } from '@/features/profile/hooks'
import { useToggleWorkoutToday } from '@/features/streak/hooks'
import { queryKeys } from '@/lib/queryKeys'
import { colors, spacing } from '@/theme'

const CELEBRATION_MS = 2000
const PHOTO_REMINDER_THRESHOLD_DAYS = 30

/*
 * Entrance factory — switches between the composed cascade (first
 * open of the hour) and a reduced uniform fade (re-opens within the
 * hour). The cadence decision comes from useHomeCadence, which
 * reads/writes the last-open timestamp in AsyncStorage.
 */
function makeEnter(cadence: Cadence) {
  if (cadence === 'reduced') {
    return (_delayMs: number) => FadeIn.duration(250)
  }
  return (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)
}

/* `latest - previous` for each metric, only when both are present. */
function calcDelta(current?: number | null, previous?: number | null): number | undefined {
  if (current == null || previous == null) return undefined
  return Number((current - previous).toFixed(2))
}

/* Local-zoned day-of-week (0–6) from 'YYYY-MM-DD' — sidesteps the
 * `new Date('YYYY-MM-DD')` UTC-midnight drift west of UTC. */
function dayOfWeekOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

export default function HomeScreen() {
  const brief = useHomeBrief()
  const cadence = useHomeCadence()
  useDayRollover(brief.data?.date)

  if (brief.isError && !brief.data) {
    return <HomeError onRetry={brief.refetch} />
  }

  if (brief.isLoading || !brief.data || cadence == null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return <HomeContent ctx={brief.data} cadence={cadence} />
}

type ContentProps = { ctx: BriefContext; cadence: Cadence }

function HomeContent({ ctx, cadence }: ContentProps) {
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const hour = new Date().getHours()
  const state = deriveDayState(ctx, hour)
  const anchor = deriveAnchorAction(ctx, state, hour)

  // The user is on Día 1 if they have never marked a workout (the
  // workouts trigger backfills profile.first_workout_at). Once the
  // optimistic toggle flips today_workout_completed=true the flag
  // turns off — at that point the celebration overlay covers the
  // home transition anyway, so the layout flip is invisible.
  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const [showCelebration, setShowCelebration] = useState(false)

  const weightDeltaKg = calcDelta(
    ctx.latest_measurement?.weight_kg,
    ctx.measurement_30d_ago?.weight_kg,
  )
  const waistDeltaCm = calcDelta(
    ctx.latest_measurement?.waist_cm,
    ctx.measurement_30d_ago?.waist_cm,
  )

  const toggleWorkout = useToggleWorkoutToday()
  const addMood = useAddMoodCheckin()

  const todayTileState = deriveTodayTileState(
    ctx.today_workout_completed,
    hour,
    dayOfWeekOf(ctx.date),
    ctx.grid_28_days,
    isFirstDay,
  )
  const todayCopy = deriveTodayTileCopy(todayTileState, ctx.day_of_week)

  // Defensive: in first-day mode the streak grid must read empty even
  // if the brief contains historical workouts (e.g., a dev user whose
  // first_workout_at trigger was added after their existing rows).
  // Keeps the visual story consistent — "you haven't done anything
  // yet" — regardless of what the server side computed.
  const firstDayGrid = useMemo(
    () => ctx.grid_28_days.map((cell) => ({ ...cell, completed: false })),
    [ctx.grid_28_days],
  )

  // Photo reminder: surface a banner when 30+ days have passed since
  // the user's last complete 4-angle set. Hidden in first-day mode
  // (the user hasn't taken anything yet). The hook returns epoch-ms
  // (not Date) so the persisted query cache survives serialisation.
  const { data: latestPhotoSetMs } = useLatestPhotoSet()
  const daysSinceLastPhotos = useMemo(() => {
    if (latestPhotoSetMs == null) return null
    const diff = Date.now() - latestPhotoSetMs
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }, [latestPhotoSetMs])
  const showPhotoReminder =
    !isFirstDay &&
    daysSinceLastPhotos !== null &&
    daysSinceLastPhotos >= PHOTO_REMINDER_THRESHOLD_DAYS

  const enter = makeEnter(cadence)

  const handleMarkWorkout = () => {
    const wasFirstDay = isFirstDay
    toggleWorkout.mutate(true)

    if (wasFirstDay) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setShowCelebration(true)
      setTimeout(() => {
        setShowCelebration(false)
        // The DB trigger has now backfilled profile.first_workout_at;
        // refresh the cache so isFirstDay flips false on the next
        // read (otherwise a kill-and-reopen could re-show Día 1
        // until the 5-minute staleness expires).
        qc.invalidateQueries({ queryKey: queryKeys.profile.all })
      }, CELEBRATION_MS)
    }
  }

  if (isFirstDay) {
    return (
      <View style={styles.screen}>
        <SafeAreaView style={styles.screen} edges={['top']}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Animated.View entering={enter(50)}>
              <HomeHeader />
            </Animated.View>

            <Animated.View entering={enter(150)}>
              <StreakCard
                days={firstDayGrid}
                streakCount={0}
                todayTileState={todayTileState}
                todayCopy={todayCopy}
                onMarkWorkout={handleMarkWorkout}
                todayWorkoutAt={null}
                isFirstDay
              />
            </Animated.View>

            <Animated.View entering={enter(700)}>
              <Day1Banner />
            </Animated.View>

            {/*
             * Día 1 keeps focus on marking the first workout but the
             * sprint's bare minimum (only StreakCard + banner) leaves
             * a visual hole below the fold. The next three are
             * passive and don't compete with the tile's CTA: a
             * macro-target prompt (the user hasn't set them yet), the
             * two quick-action pills, and the mood picker. Hidden:
             * MacrosTodayCard (no targets to show), LogMealButton
             * (no targets), DeltaPair (no comparison possible), and
             * AnchorLine (would over-prescribe on day one).
             */}
            <Animated.View entering={enter(900)}>
              <DefineTargetsBanner />
            </Animated.View>

            <Animated.View entering={enter(1100)}>
              <QuickActions />
            </Animated.View>

            <Animated.View entering={enter(1300)}>
              <MoodPicker
                value={ctx.latest_mood?.value ?? null}
                onChange={(value) => addMood.mutate(value)}
              />
            </Animated.View>
          </ScrollView>
        </SafeAreaView>

        {showCelebration ? <Day1Celebration /> : null}
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(50)}>
            <HomeHeader />
          </Animated.View>

          <Animated.View entering={enter(150)}>
            <StreakCard
              days={ctx.grid_28_days}
              streakCount={ctx.streak_days}
              todayTileState={todayTileState}
              todayCopy={todayCopy}
              onMarkWorkout={handleMarkWorkout}
              todayWorkoutAt={ctx.today_workout_at}
            />
          </Animated.View>

          {showPhotoReminder && daysSinceLastPhotos !== null ? (
            <Animated.View entering={enter(1300)}>
              <PhotoReminderBanner daysAgo={daysSinceLastPhotos} />
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(1500)}>
            {ctx.targets ? (
              <MacrosTodayCard
                current={ctx.today_macros}
                target={ctx.targets}
                mealCount={ctx.meal_count_today}
              />
            ) : (
              <DefineTargetsBanner />
            )}
          </Animated.View>

          {ctx.targets && (
            <Animated.View entering={enter(1700)}>
              <LogMealButton />
            </Animated.View>
          )}

          <Animated.View entering={enter(1900)}>
            <DeltaPair weightDeltaKg={weightDeltaKg} waistDeltaCm={waistDeltaCm} periodWeeks={4} />
          </Animated.View>

          <Animated.View entering={enter(2050)}>
            <AnchorLine text={anchor} />
          </Animated.View>

          <Animated.View entering={enter(2200)}>
            <QuickActions />
          </Animated.View>

          <Animated.View entering={enter(2350)}>
            <MoodPicker
              value={ctx.latest_mood?.value ?? null}
              onChange={(value) => addMood.mutate(value)}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {showCelebration ? <Day1Celebration /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
})
