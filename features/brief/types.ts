import type { ImageSourcePropType } from 'react-native'

export type BriefData = {
  date: string
  dayOfWeek: string
  time: string
  streak: {
    days: number
  }
  progress: {
    beforePhoto: ImageSourcePropType
    afterPhoto: ImageSourcePropType
    beforeLabel: string
    afterLabel: string
    weightDeltaKg: number
    waistDeltaCm: number
    periodWeeks: number
  }
  today: {
    weightKg: number
    sleepHours: number
  }
  pattern: {
    detected: boolean
    message: string
  }
  todayWorkoutCompleted: boolean
}
