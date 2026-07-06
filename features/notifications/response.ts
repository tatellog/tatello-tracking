import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'

import { requestOrbitSegment } from '@/features/orbit/pending-segment'

import type { NotificationTarget } from './scheduler'

/*
 * El destino del TAP — cierra la promesa rota del canal: el sello del
 * lunes decía "tu cielo la guarda" y el tap aterrizaba frío en Hoy porque
 * ningún listener leía la notificación. Ahora cada push lleva
 * `data.target` (scheduler.ts) y este hook lo convierte en navegación,
 * reutilizando el mailbox de Órbita (pending-segment) que ya usan las
 * ceremonias para aterrizar en un segmento.
 *
 * Cold start: getLastNotificationResponseAsync entrega la respuesta que
 * ABRIÓ la app, pero puede devolver una vieja tras un reload de JS — solo
 * se actúa si es reciente (< 60 s), para no re-navegar a Órbita en una
 * apertura normal.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient'

/** Cuán vieja puede ser la respuesta de cold start antes de ignorarla. */
const COLD_START_MAX_AGE_MS = 60_000

function landFactory(router: ReturnType<typeof useRouter>) {
  return (data: unknown) => {
    const target = (data as { target?: NotificationTarget } | null)?.target
    if (target === 'orbit-semana') {
      requestOrbitSegment('semana')
      router.navigate('/(tabs)/orbit')
    } else if (target === 'hoy') {
      router.navigate('/(tabs)')
    }
    // Sin target (notificación vieja o ajena): no navegar a ciegas.
  }
}

export function useNotificationResponseRouter(): void {
  const router = useRouter()

  useEffect(() => {
    if (isExpoGo) return
    let cancelled = false
    let sub: { remove: () => void } | null = null
    const land = landFactory(router)

    ;(async () => {
      try {
        // Import dinámico: expo-notifications fuera del module-eval (mismo
        // patrón que scheduler.ts; en Expo Go no existe el módulo nativo).
        const Notifications = await import('expo-notifications')
        if (cancelled) return

        const last = await Notifications.getLastNotificationResponseAsync().catch(() => null)
        if (!cancelled && last) {
          // `date` viene en segundos en algunas plataformas; normalizar.
          const raw = last.notification.date
          const deliveredMs = raw < 1e12 ? raw * 1000 : raw
          if (Date.now() - deliveredMs < COLD_START_MAX_AGE_MS) {
            land(last.notification.request.content.data)
          }
        }

        sub = Notifications.addNotificationResponseReceivedListener((resp) => {
          land(resp.notification.request.content.data)
        })
      } catch {
        // Un canal de notificaciones roto jamás debe romper la app.
      }
    })()

    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [router])
}
