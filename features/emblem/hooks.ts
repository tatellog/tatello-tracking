import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { queryKeys } from '@/lib/queryKeys'

import { fetchTransformPoints } from './api'
import { stageForProgress, transformProgressForPoints, type EmblemStage } from './logic'

// High-water-mark del reveal: lo revelado NUNCA se esconde (regla del PRD +
// la promesa "Tu transformación nunca retrocede"). El % crudo es función de
// los puntos ACTUALES, así que destogglear un registro hoy (Entrené −10,
// agua −3) lo bajaría y el emblema se des-revelaría. Guardamos el máximo
// alcanzado en disco y nunca mostramos menos. Local por dispositivo para el
// MVP; la versión durable sería una columna max_transform_progress en
// Postgres actualizada por la RPC (no des-revelar entre dispositivos).
const EMBLEM_HWM_KEY = 'stelar.emblem.progress_hwm'

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
 * recompensa. (Si ya hay un high-water-mark en disco, se muestra ese
 * de una vez — el reveal no parpadea a 0 mientras la RPC resuelve.)
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

  const rawProgress = transformProgressForPoints(query.data ?? 0)

  // El piso monotónico. Se hidrata de disco al montar y solo SUBE: nunca
  // se persiste un valor menor → el reveal jamás retrocede.
  const [floor, setFloor] = useState(0)
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(EMBLEM_HWM_KEY)
      .then((v) => {
        const stored = v != null ? Number(v) : 0
        if (active && Number.isFinite(stored) && stored > 0) setFloor((f) => Math.max(f, stored))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (rawProgress > floor) {
      setFloor(rawProgress)
      AsyncStorage.setItem(EMBLEM_HWM_KEY, String(rawProgress)).catch(() => {})
    }
  }, [rawProgress, floor])

  const progress = Math.max(rawProgress, floor)
  return { progress, stage: stageForProgress(progress), isLoading: query.isLoading }
}
