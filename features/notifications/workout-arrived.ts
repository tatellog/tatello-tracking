/*
 * "Entreno registrado" (dueña 1 oct 2026): cuando el reloj escribe un entreno
 * en Salud y Stelar lo recibe en SEGUNDO PLANO (background delivery), Stelar
 * avisa. Copy claro y útil, sin romantizar: qué llegó, de dónde, y qué hacer.
 * El tap abre Hoy y corre la celebración del emblema (target 'hoy-workout').
 *
 * Fuera del arbitraje 1/día de las invitaciones: no es una invitación sino la
 * respuesta a algo que ella hizo, y sale una vez por entreno. Sin permiso del
 * OS, no hace nada (los datos se guardan igual).
 */
import Constants from 'expo-constants'

import { track } from '@/lib/analytics'

const isExpoGo = Constants.executionEnvironment === 'storeClient'

const TYPE_NAME: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  caminata: 'Caminata',
}

/** El texto de la notificación (puro, testeable). */
export function workoutArrivedCopy(w: { type: string | null; minutes: number | null }): {
  title: string
  body: string
} {
  const name = TYPE_NAME[w.type ?? ''] ?? 'Entreno'
  const mins = w.minutes != null && w.minutes > 0 ? `, ${w.minutes} min` : ''
  return {
    title: name === 'Entreno' ? `Entreno registrado${mins}` : `Entreno registrado: ${name}${mins}`,
    body: 'Lo trajo tu reloj. Toca para verlo en Stelar.',
  }
}

export async function notifyWorkoutArrived(w: {
  type: string | null
  minutes: number | null
  date: string
}): Promise<void> {
  if (isExpoGo) return
  try {
    const Notifications = await import('expo-notifications')
    const perm = await Notifications.getPermissionsAsync()
    if (!perm.granted) return
    const { title, body } = workoutArrivedCopy(w)
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: { target: 'hoy-workout', date: w.date } },
      trigger: null,
    })
    track('notif_scheduled', { id: 'workout-arrived', type: w.type ?? 'otro' })
  } catch {
    // Best-effort: sin notificación, el entreno igual quedó guardado.
  }
}
