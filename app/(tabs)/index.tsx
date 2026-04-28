import { ScrollView, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { BriefContext } from '@/features/brief/api'
import {
  AnchorLine,
  DeltaPair,
  HomeError,
  HomeHeader,
  HomeSkeleton,
  MoodPicker,
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
import { useToggleWorkoutToday } from '@/features/streak/hooks'
import { colors, spacing } from '@/theme'

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
  const hour = new Date().getHours()
  const state = deriveDayState(ctx, hour)
  const anchor = deriveAnchorAction(ctx, state, hour)

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
  )
  const todayCopy = deriveTodayTileCopy(todayTileState, ctx.day_of_week)

  const enter = makeEnter(cadence)

  return (
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
            onMarkWorkout={() => toggleWorkout.mutate(true)}
            todayWorkoutAt={ctx.today_workout_at}
          />
        </Animated.View>

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
