/*
 * El estado de la oferta de avisos en contexto (ver offer-logic.ts). Vive en
 * AsyncStorage por usuaria y se espeja en React Query para que Hoy (la primera
 * comida) y Descubre (el primer patrón) lean el mismo estado sin desfasarse.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { NotificationWindow } from '@/features/profile/api'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'

import {
  nextOfferState,
  type OfferState,
  type OfferTrigger,
  shouldOffer,
  windowForHour,
} from './offer-logic'
import { applyNotificationWindow } from './window'

const KEY = 'stelar.notif-offer'
/** Respiro tras volver a la pantalla: deja pasar la reacción del hero. */
const SHOW_DELAY_MS = 1600

const storageKey = (uid: string) => `${KEY}:${uid}`
const queryKey = (uid: string) => ['notifications', 'offer', uid] as const

async function readState(uid: string): Promise<OfferState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid))
    return raw === 'declined' || raw === 'done' ? raw : 'none'
  } catch {
    return 'none'
  }
}

/**
 * La oferta para un disparador. `ready` = la pantalla está libre (sin otra
 * ceremonia encima) y el disparador ocurrió (hay comida / hay patrón).
 */
export function useNotifyOffer(trigger: OfferTrigger, ready: boolean) {
  const qc = useQueryClient()
  const { session } = useSession()
  const uid = session?.user?.id ?? null
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const { data: state } = useQuery({
    queryKey: uid ? queryKey(uid) : ['notifications', 'offer', 'off'],
    queryFn: () => (uid ? readState(uid) : Promise.resolve<OfferState>('done')),
    enabled: uid != null,
    staleTime: Infinity,
  })
  const [visible, setVisible] = useState(false)

  const window = profile
    ? ((profile.notification_window ?? null) as NotificationWindow | null)
    : undefined
  const eligible =
    ready && state != null && window !== undefined && shouldOffer(trigger, state, window)

  useEffect(() => {
    if (!eligible || visible) return
    const t = setTimeout(() => {
      setVisible(true)
      track('notif_offer_shown', { trigger })
    }, SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [eligible, visible, trigger])

  const answer = async (accepted: boolean) => {
    setVisible(false)
    if (!uid) return
    const next = nextOfferState(trigger, accepted)
    qc.setQueryData(queryKey(uid), next)
    AsyncStorage.setItem(storageKey(uid), next).catch(() => {})
    track('notif_offer_answered', { trigger, accepted })
    if (!accepted) return
    // Deja que la hoja termine de cerrarse: iOS no presenta el permiso del
    // sistema sobre un Modal que todavía se está yendo.
    await new Promise((r) => setTimeout(r, 450))
    try {
      await applyNotificationWindow(windowForHour(new Date().getHours()), {
        previous: window ?? null,
        source: trigger === 'meal' ? 'offer_meal' : 'offer_pattern',
        save: (w) => updateProfile.mutateAsync({ notification_window: w }),
      })
    } catch {
      // Sin guardar: la hora sigue editable en Ajustes.
    }
  }

  return {
    visible,
    accept: () => void answer(true),
    decline: () => void answer(false),
  }
}
