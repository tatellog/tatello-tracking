import type { ImageSourcePropType } from 'react-native'

export type Streak = {
  days: number
}

export type ProgressComparison = {
  beforePhoto?: ImageSourcePropType
  afterPhoto?: ImageSourcePropType
  beforeLabel: string
  afterLabel: string
  weightDeltaKg: number
  waistDeltaCm: number
  periodWeeks: number
}

export type TodayMetrics = {
  weightKg: number
  sleepHours: number
}

export type PatternAlert = {
  detected: boolean
  message: string
}

export type BriefData = {
  date: string
  dayOfWeek: string
  time: string
  streak: Streak
  progress: ProgressComparison
  today: TodayMetrics
  pattern: PatternAlert
  todayWorkoutCompleted: boolean
}
