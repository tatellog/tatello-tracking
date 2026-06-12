import { useQuery } from '@tanstack/react-query'

import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { queryKeys } from '@/lib/queryKeys'

import { fetchTransformPoints } from './api'
import { stageForProgress, transformProgressForPoints, type EmblemStage } from './logic'

/*
 * Progreso real del Emblema Celeste.
 *
 * El acumulado se mueve LENTO (máx. 30 pts/día sobre 600) — no
 * necesita invalidación por registro: staleTime generoso + refetch al
 * volver a la app alcanzan. Si algún día el delta del día debe verse
 * al instante, invalidar queryKeys.emblem.all en las mutaciones.
 *
 * Mientras carga (o sin sesión) el progreso es 0: el emblema
 * simplemente aún no se revela — nunca un spinner para una capa de
 * recompensa.
 */
export function useTransformProgress(): {
  progress: number
  stage: EmblemStage
  isLoading: boolean
} {
  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  const query = useQuery({
    queryKey: queryKeys.emblem.points(waterGoalGlasses),
    queryFn: () => fetchTransformPoints(waterGoalGlasses),
    staleTime: 5 * 60 * 1000,
  })

  const progress = transformProgressForPoints(query.data ?? 0)
  return { progress, stage: stageForProgress(progress), isLoading: query.isLoading }
}
