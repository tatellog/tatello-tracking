import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { duration } from '@/design/motion'
import { Masthead } from '@/features/brief/components/Masthead'
import { MetricPair } from '@/features/brief/components/MetricPair'
import { PatternAlert } from '@/features/brief/components/PatternAlert'
import { ProgressComparison } from '@/features/brief/components/ProgressComparison'
import { StreakHero } from '@/features/brief/components/StreakHero'
import { WorkoutCheckIn } from '@/features/brief/components/WorkoutCheckIn'
import { useBriefData } from '@/features/brief/useBriefData'

/*
 * Entrance sequence — each block fades in + translates 12px up. The editorial
 * cadence reads top-to-bottom: masthead first, then the reader's eye is
 * walked down through patrón → photos → deltas → métricas → racha.
 *
 * Durations/stagger live in `design/motion.ts`. Tune there, not here.
 */
const enter = (delayMs: number) =>
  FadeInDown.duration(duration.slow).delay(delayMs).springify().damping(18)

export default function BriefScreen() {
  const data = useBriefData()
  const [workoutCompleted, setWorkoutCompleted] = useState(data.todayWorkoutCompleted)

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-4 pb-4"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(0)}>
          <Masthead dayOfWeek={data.dayOfWeek} time={data.time} />
        </Animated.View>

        <View className="mt-8 gap-8">
          {data.pattern.detected && (
            <Animated.View entering={enter(100)}>
              <PatternAlert detected={data.pattern.detected} message={data.pattern.message} />
            </Animated.View>
          )}

          <Animated.View entering={enter(180)}>
            <ProgressComparison
              before={data.progress.beforePhoto}
              after={data.progress.afterPhoto}
              beforeLabel={data.progress.beforeLabel}
              afterLabel={data.progress.afterLabel}
              weightDeltaKg={data.progress.weightDeltaKg}
              waistDeltaCm={data.progress.waistDeltaCm}
              periodWeeks={data.progress.periodWeeks}
            />
          </Animated.View>

          <Animated.View entering={enter(260)}>
            <MetricPair
              items={[
                { label: 'Peso', value: data.today.weightKg, unit: 'kg' },
                { label: 'Sueño', value: data.today.sleepHours, unit: 'h' },
              ]}
            />
          </Animated.View>

          <Animated.View entering={enter(340)}>
            <StreakHero days={data.streak.days} />
          </Animated.View>
        </View>
      </ScrollView>

      <View className="border-t border-muted bg-canvas px-6 pb-4 pt-3">
        <WorkoutCheckIn
          completed={workoutCompleted}
          onPress={() => setWorkoutCompleted((prev) => !prev)}
        />
      </View>
    </SafeAreaView>
  )
}
