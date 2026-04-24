import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MetricPair } from '@/features/brief/components/MetricPair'
import { PatternAlert } from '@/features/brief/components/PatternAlert'
import { ProgressComparison } from '@/features/brief/components/ProgressComparison'
import { StreakHero } from '@/features/brief/components/StreakHero'
import { WorkoutCheckIn } from '@/features/brief/components/WorkoutCheckIn'
import { useBriefData } from '@/features/brief/useBriefData'

export default function BriefScreen() {
  const data = useBriefData()
  const [workoutCompleted, setWorkoutCompleted] = useState(data.todayWorkoutCompleted)

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pt-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[12px] text-tertiary">
          {data.dayOfWeek} · {data.time}
        </Text>
        <View className="mt-6 gap-6">
          <StreakHero days={data.streak.days} />
          <ProgressComparison
            before={data.progress.beforePhoto}
            after={data.progress.afterPhoto}
            beforeLabel={data.progress.beforeLabel}
            afterLabel={data.progress.afterLabel}
            weightDeltaKg={data.progress.weightDeltaKg}
            waistDeltaCm={data.progress.waistDeltaCm}
            periodWeeks={data.progress.periodWeeks}
          />
          <MetricPair
            items={[
              { label: 'Peso', value: data.today.weightKg, unit: 'kg' },
              { label: 'Sueño', value: data.today.sleepHours, unit: 'h' },
            ]}
          />
          <PatternAlert detected={data.pattern.detected} message={data.pattern.message} />
          <WorkoutCheckIn
            completed={workoutCompleted}
            onPress={() => setWorkoutCompleted((prev) => !prev)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
