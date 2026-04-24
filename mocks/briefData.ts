import type { BriefData } from '@/features/brief/types'

export const mockBriefData: BriefData = {
  date: '2026-04-23',
  dayOfWeek: 'Sábado',
  time: '8:12',
  streak: {
    days: 14,
  },
  progress: {
    beforePhoto: require('./photos/before.jpg'),
    afterPhoto: require('./photos/after.jpg'),
    beforeLabel: 'hace 30 días',
    afterLabel: 'hoy',
    weightDeltaKg: -1.8,
    waistDeltaCm: -2,
    periodWeeks: 4,
  },
  today: {
    weightKg: 76.2,
    sleepHours: 5.8,
  },
  pattern: {
    detected: true,
    message:
      'Sábado + sueño corto. Las últimas 3 veces rompiste la racha. No dejes que hoy sea la 4.',
  },
  todayWorkoutCompleted: false,
}
