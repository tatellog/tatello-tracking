import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { useSession } from '@/hooks/useSession'
import { queryKeys } from '@/lib/queryKeys'

import { fetchTransformPoints, fetchTransformPointsAsOf } from './api'
import { stageForProgress, transformProgressForPoints, type EmblemStage } from './logic'

// High-water-mark del reveal: lo revelado NUNCA se esconde (regla del PRD +
// la promesa "Tu transformación nunca retrocede"). El % crudo es función de
// los puntos ACTUALES, así que destogglear un registro hoy (Entrené −10,
// agua −3) lo bajaría y el emblema se des-revelaría. Guardamos el máximo
// alcanzado en disco y nunca mostramos menos. La versión durable sería una
// columna max_transform_progress en Postgres actualizada por la RPC.
//
// Scopeado POR USUARIO: la key lleva el id de la sesión. Sin esto era global
// del dispositivo, así que un usuario NUEVO heredaba el % del usuario anterior
// (p. ej. abrir con tatellog tras un seed mostraba 82% que no era suyo).
const EMBLEM_HWM_PREFIX = 'stelar.emblem.progress_hwm'
const hwmKeyFor = (userId: string | null): string | null =>
  userId ? `${EMBLEM_HWM_PREFIX}:${userId}` : null

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

  // El piso monotónico, POR USUARIO. Se hidrata de disco al montar (y al cambiar
  // de usuario) y solo SUBE: nunca se persiste un valor menor → el reveal jamás
  // retrocede. La key lleva el id de sesión para no heredar el piso de otra cuenta.
  const hwmKey = hwmKeyFor(useSession().session?.user?.id ?? null)
  const [floor, setFloor] = useState(0)
  useEffect(() => {
    let active = true
    // Resetea al cambiar de usuario antes de hidratar el suyo (si no, el piso del
    // usuario anterior seguiría en estado hasta que el nuevo lea su disco).
    setFloor(0)
    if (hwmKey == null) return
    AsyncStorage.getItem(hwmKey)
      .then((v) => {
        const stored = v != null ? Number(v) : 0
        if (active && Number.isFinite(stored) && stored > 0) setFloor((f) => Math.max(f, stored))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [hwmKey])
  useEffect(() => {
    if (hwmKey == null) return
    if (rawProgress > floor) {
      setFloor(rawProgress)
      AsyncStorage.setItem(hwmKey, String(rawProgress)).catch(() => {})
    }
  }, [rawProgress, floor, hwmKey])

  const progress = Math.max(rawProgress, floor)
  return { progress, stage: stageForProgress(progress), isLoading: query.isLoading }
}

/*
 * Progreso del emblema a una FECHA DE CORTE (el "antes" de Tu Historia). Sin
 * high-water-mark: es un valor histórico puro (puntos acumulados hasta `asOf`,
 * mapeados a %). `null` deshabilita la query.
 */
export function useTransformProgressAsOf(asOf: string | null): {
  progress: number | null
  isLoading: boolean
} {
  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))
  const query = useQuery({
    queryKey: ['emblem', 'pointsAsOf', asOf, waterGoalGlasses] as const,
    queryFn: () => fetchTransformPointsAsOf(asOf as string, waterGoalGlasses),
    enabled: asOf != null,
    staleTime: 5 * 60 * 1000,
  })
  return {
    progress: query.data != null ? transformProgressForPoints(query.data) : null,
    isLoading: query.isLoading,
  }
}
