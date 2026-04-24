import { ScrollView, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { BriefContext } from '@/features/brief/api'
import {
  AnchorLine,
  DeltaPair,
  HomeHeader,
  HomeSkeleton,
  MoodPicker,
  QuickActions,
  StreakCard,
  SwipeToSeal,
} from '@/features/home/components'
import { deriveAnchorAction, deriveContextMessage, deriveDayState } from '@/features/home/logic'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import type { MoodValue } from '@/features/moods/api'
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

export default function HomeScreen() {
  const brief = useHomeBrief()
  const cadence = useHomeCadence()

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
  const state = deriveDayState(ctx)
  const anchor = deriveAnchorAction(ctx, state)
  const contextMessage = deriveContextMessage(ctx, state)

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

  const enter = makeEnter(cadence)

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(50)}>
          <HomeHeader dayOfWeek={ctx.day_of_week} date={ctx.date} />
        </Animated.View>

        <Animated.View entering={enter(150)}>
          <StreakCard
            days={ctx.grid_28_days}
            streakCount={ctx.streak_days}
            contextMessage={contextMessage}
          />
        </Animated.View>

        <Animated.View entering={enter(1700)}>
          <DeltaPair weightDeltaKg={weightDeltaKg} waistDeltaCm={waistDeltaCm} periodWeeks={4} />
        </Animated.View>

        <Animated.View entering={enter(1850)}>
          <AnchorLine text={anchor} />
        </Animated.View>

        <Animated.View entering={enter(2000)}>
          <SwipeToSeal
            sealed={ctx.today_workout_completed}
            onSeal={() => toggleWorkout.mutate(!ctx.today_workout_completed)}
          />
        </Animated.View>

        <Animated.View entering={enter(2150)}>
          <QuickActions />
        </Animated.View>

        <Animated.View entering={enter(2300)}>
          <MoodPicker
            value={(ctx.latest_mood?.value ?? null) as MoodValue | null}
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
    backgroundColor: colors.creamWarm,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
})
