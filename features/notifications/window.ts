/*
 * Guardar la ventana de avisos (mañana / mediodía / noche / aún no) — el mismo
 * flujo desde el onboarding y desde el control en línea de Ajustes.
 *
 * Una ventana real pide el permiso del sistema si todavía se puede pedir; 'not_yet'
 * nunca lo pide. La preferencia se guarda SIEMPRE, aunque el permiso se niegue:
 * es su intención, y el re-intento vive en Ajustes. Devuelve el estado del
 * permiso para que Ajustes diga con honestidad cuando el teléfono los bloquea.
 */
import Constants from 'expo-constants'

import type { NotificationWindow } from '@/features/profile/api'
import { track } from '@/lib/analytics'

// Expo Go (SDK 53+) no trae el módulo nativo de expo-notifications; importarlo
// en el módulo truena en Android. Import dinámico + sin pedir permiso en Expo Go.
const isExpoGo = Constants.executionEnvironment === 'storeClient'

export type PermissionState = 'granted' | 'denied' | 'blocked' | 'unknown'

/** El permiso del sistema sin pedirlo (para el aviso de "tu teléfono los tiene
 *  apagados"). 'blocked' = negado y el sistema ya no deja volver a preguntar. */
export async function readNotificationPermission(): Promise<PermissionState> {
  if (isExpoGo) return 'unknown'
  try {
    const Notifications = await import('expo-notifications')
    const s = await Notifications.getPermissionsAsync()
    if (s.status === 'granted') return 'granted'
    return s.canAskAgain ? 'denied' : 'blocked'
  } catch {
    return 'unknown'
  }
}

async function askPermission(window: NotificationWindow): Promise<PermissionState> {
  if (isExpoGo) return 'unknown'
  const Notifications = await import('expo-notifications')
  const settings = await Notifications.getPermissionsAsync()
  let status = settings.status
  let canAskAgain = settings.canAskAgain
  if (status !== 'granted' && canAskAgain) {
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })
    status = result.status
    canAskAgain = result.canAskAgain
  }
  track('notif_permission_result', {
    granted: status === 'granted',
    window,
    can_ask_again: canAskAgain,
  })
  if (status === 'granted') return 'granted'
  return canAskAgain ? 'denied' : 'blocked'
}

/**
 * Pide permiso (si aplica), guarda la ventana y registra el cambio. Nunca lanza
 * por el permiso: un error del sistema no impide guardar la preferencia.
 */
export async function applyNotificationWindow(
  window: NotificationWindow,
  opts: {
    previous: NotificationWindow | null
    source: 'settings' | 'onboarding' | 'offer_meal' | 'offer_pattern'
    save: (window: NotificationWindow) => Promise<unknown>
  },
): Promise<PermissionState> {
  let permission: PermissionState = 'unknown'
  if (window !== 'not_yet') {
    try {
      permission = await askPermission(window)
    } catch (err) {
      console.warn('notification permission flow:', err)
    }
  }
  await opts.save(window)
  if (opts.previous !== window) {
    track('notif_window_changed', { from: opts.previous, to: window, source: opts.source })
  }
  return permission
}
