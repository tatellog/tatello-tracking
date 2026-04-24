import { ScrollView, StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
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
import type { MoodValue } from '@/features/moods/api'
import { useAddMoodCheckin } from '@/features/moods/hooks'
import { useToggleWorkoutToday } from '@/features/streak/hooks'
import { colors, spacing } from '@/theme'

/*
 * Entrance choreography — the eye reads top-to-bottom, so the
 * delays cascade: header first, streak card immediately after (its
 * own grid cascade runs ~1.1 s and is what we wait on), then the
 * rest of the blocks chain in 150 ms intervals so the rhythm feels
 * composed, not random.
 */
const enter = (delayMs: number) => FadeInDown.duration(400).delay(delayMs).springify().damping(18)

/* `latest - previous` for each metric, only when both are present. */
function calcDelta(current?: number | null, previous?: number | null): number | undefined {
  if (current == null || previous == null) return undefined
  return Number((current - previous).toFixed(2))
}

export default function HomeScreen() {
  const brief = useHomeBrief()

  if (brief.isLoading || !brief.data) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return <HomeContent ctx={brief.data} />
}

type ContentProps = { ctx: BriefContext }

function HomeContent({ ctx }: ContentProps) {
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={enter(50)}>
          <HomeHeader dayOfWeek={ctx.day_of_week} date={ctx.date} />
        </Animated.View>

        <Animated.View entering={enter(150)} style={styles.block}>
          <StreakCard
            days={ctx.grid_28_days}
            streakCount={ctx.streak_days}
            contextMessage={contextMessage}
          />
        </Animated.View>

        <Animated.View entering={enter(1700)} style={styles.block}>
          <DeltaPair weightDeltaKg={weightDeltaKg} waistDeltaCm={waistDeltaCm} periodWeeks={4} />
        </Animated.View>

        <Animated.View entering={enter(1850)} style={styles.block}>
          <AnchorLine text={anchor} />
        </Animated.View>

        <Animated.View entering={enter(2000)} style={styles.block}>
          <SwipeToSeal
            sealed={ctx.today_workout_completed}
            onSeal={() => toggleWorkout.mutate(!ctx.today_workout_completed)}
          />
        </Animated.View>

        <Animated.View entering={enter(2150)} style={styles.block}>
          <QuickActions />
        </Animated.View>

        <Animated.View entering={enter(2300)} style={styles.block}>
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
  block: {
    // Each Animated.View becomes a layout block; the `gap` on the
    // ScrollView's contentContainer handles the vertical rhythm.
  },
})
