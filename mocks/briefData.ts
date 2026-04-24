import type { BriefData } from '@/features/brief/types'

export const mockBriefData: BriefData = {
  date: '2026-04-23',
  dayOfWeek: 'Sábado',
  time: '8:12',
  streak: {
    days: 14,
  },
  progress: {
    // Photos omitted to preview the empty state. When the user uploads real
    // photos (Sprint 3, camera integration), set beforePhoto + afterPhoto to
    // the returned ImageSource and the polaroid frames render them directly.
    beforeLabel: 'Hace 30 días',
    afterLabel: 'Hoy',
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
