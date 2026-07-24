import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'

import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { track } from '@/lib/analytics'

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
  return (data: unknown, info: { id: string; coldStart: boolean }) => {
    const target = (data as { target?: NotificationTarget } | null)?.target
    if (target === 'orbit-semana') {
      requestOrbitSegment('semana')
      router.navigate('/(tabs)/orbit')
    } else if (target === 'orbit-mes') {
      requestOrbitSegment('mes')
      router.navigate('/(tabs)/orbit')
    } else if (target === 'hoy') {
      router.navigate('/(tabs)')
    } else if (target === 'weekly-reading') {
      // N8 promete la lectura → aterriza EN /weekly-reading (la pantalla
      // misma marca opened_at y emite insight_opened al mostrarla).
      router.navigate('/weekly-reading')
    } else {
      // Sin target (notificación vieja o ajena): no navegar a ciegas, no
      // contaminar la telemetría del canal.
      return
    }
    // Telemetría del canal: el tap es la mitad "opened" del proxy
    // scheduled/opened (ver trackScheduled en scheduler.ts). cold_start
    // marca las aperturas atribuibles al push (la app nació de este tap).
    track('notif_opened', { id: info.id, target, cold_start: info.coldStart })
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
            land(last.notification.request.content.data, {
              id: last.notification.request.identifier,
              coldStart: true,
            })
          }
        }

        sub = Notifications.addNotificationResponseReceivedListener((resp) => {
          land(resp.notification.request.content.data, {
            id: resp.notification.request.identifier,
            coldStart: false,
          })
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
