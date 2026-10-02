/*
 * Android · el aviso "Entreno registrado" sin abrir la app (dueña 1 oct 2026).
 *
 * Health Connect no tiene el "despiértame cuando llegue un dato" de HealthKit
 * (background delivery). Lo más cercano que permite Android es una tarea
 * periódica (WorkManager vía expo-background-task, mínimo 15 min): lee Health
 * Connect, guarda lo nuevo y, si llegó un entreno de hoy que no se había
 * visto, manda el aviso. El tap y la celebración son los mismos que en iOS.
 * Requiere el permiso de Health Connect "leer datos en segundo plano" (se pide
 * al conectar).
 *
 * iOS también la registra (2 oct 2026): el background delivery de Salud
 * despierta a Stelar, pero si el iPhone está BLOQUEADO los datos de Salud están
 * cifrados y la lectura sale vacía (pasó en prod: despertó a las 10:29 y leyó
 * 0 de todo). La tarea periódica (BGTaskScheduler, iOS decide cuándo) vuelve a
 * intentar más tarde, ya desbloqueado, y manda el aviso que se perdió.
 *
 * `defineTask` va a nivel de módulo (Android puede arrancar SOLO la tarea, sin
 * UI): este archivo se importa desde app/_layout.tsx por su efecto.
 */
import { Platform } from 'react-native'
import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'

export const HEALTH_SYNC_TASK = 'stelar-health-sync'

if (Platform.OS === 'android' || Platform.OS === 'ios') {
  TaskManager.defineTask(HEALTH_SYNC_TASK, async () => {
    try {
      // Import perezoso: evita el ciclo hooks ↔ background-sync y no carga
      // supabase/React Query hasta que la tarea de verdad corre.
      const [{ supabase }, { backgroundHealthSync }] = await Promise.all([
        import('@/lib/supabase'),
        import('./hooks'),
      ])
      const { data } = await supabase.auth.getSession()
      const userId = data.session?.user?.id
      if (userId) await backgroundHealthSync(userId)
      return BackgroundTask.BackgroundTaskResult.Success
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed
    }
  })
}

/** Registra la tarea periódica (idempotente). Android e iOS. */
export async function registerHealthBackgroundSync(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return
  try {
    if (await TaskManager.isTaskRegisteredAsync(HEALTH_SYNC_TASK)) return
    await BackgroundTask.registerTaskAsync(HEALTH_SYNC_TASK, { minimumInterval: 15 })
  } catch {
    // Sin WorkManager disponible: el sync al abrir sigue siendo el respaldo.
  }
}

/** Deja de revisar en segundo plano (al desconectar). */
export async function unregisterHealthBackgroundSync(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return
  try {
    if (await TaskManager.isTaskRegisteredAsync(HEALTH_SYNC_TASK)) {
      await BackgroundTask.unregisterTaskAsync(HEALTH_SYNC_TASK)
    }
  } catch {
    // Nada que desregistrar.
  }
}
