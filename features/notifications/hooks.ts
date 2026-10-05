import { useEffect } from 'react'

import { useQuery } from '@tanstack/react-query'

import { useMacroTargets, useMealsForDate } from '@/features/macros/hooks'
import { useHasAnySignals, useIsoWeekSignals, useSignalsHistory } from '@/features/orbit/hooks'
import { detectMonthPatterns } from '@/features/orbit/month-built'
import { useRecentOrbitPattern } from '@/features/orbit/pattern-memory'
import type { NotificationWindow } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { useSession } from '@/hooks/useSession'
import { aiEnabledForEmail, WEEKLY_READING_ENABLED } from '@/lib/featureFlags'
import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'

import {
  findingPushCopy,
  pickFindingToAnnounce,
  readFindingLedger,
  writeFindingLedgerEntry,
} from './finding-push'
import { weeklyReadingGuaranteed } from './invite'
import {
  syncCycleSealInvite,
  syncDayCloseInvite,
  syncFindingInvite,
  syncNextStarInvite,
  syncOrbitPatternInvite,
  syncWeeklyReadingInvite,
  syncWeekSealInvite,
} from './scheduler'

/*
 * Monta el scheduler de las invitaciones: en cada sesión (y cada vez que la
 * ventana elegida cambie desde onboarding o Ajustes) re-agenda (a) la única
 * invitación de mañana y (b) la cita del lunes (el sello de semana, solo
 * con datos). Ver invite.ts para la mecánica de auto-capado.
 */
export function useNextStarInvite(): void {
  const { data: profile } = useProfile()
  const hasAny = useHasAnySignals()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined

  useEffect(() => {
    // undefined = perfil aún cargando: no cancelar lo agendado por un
    // estado transitorio. null/'not_yet' sí sincronizan (cancelan).
    if (window === undefined) return
    void syncNextStarInvite(window)
  }, [window])

  useEffect(() => {
    if (window === undefined || hasAny.data === undefined) return
    void syncWeekSealInvite(window, hasAny.data === true)
  }, [window, hasAny.data])
}

/*
 * La cita del cierre: reacciona a las comidas de HOY (misma query cacheada
 * que pinta Comidas, cero fetch extra). Primera comida del día → se agenda
 * el push de las 20:15; día sin comida → se cancela. El push solo existe
 * en días que lo GANARON, así que nunca es reproche.
 *
 * `hasAny` alimenta el arbitraje 1/día: el lunes que el sello es elegible,
 * el cierre cede (misma query cacheada que ya usa useNextStarInvite).
 */
export function useDayCloseInvite(): void {
  const { data: profile } = useProfile()
  const hasAny = useHasAnySignals()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined
  const meals = useMealsForDate(todayInTimezone())
  const mealCount = meals.data?.length

  useEffect(() => {
    if (window === undefined || mealCount === undefined || hasAny.data === undefined) return
    void syncDayCloseInvite(window, mealCount > 0, hasAny.data === true)
  }, [window, mealCount, hasAny.data])
}

/*
 * N5 · el sello del ciclo mensual: Hoy ya calcula la figura del mes
 * (trainedThisMonth vs figureCount), así que recibe la señal por args en
 * lugar de re-derivarla. En cuanto la figura se completa, el anuncio queda
 * agendado para el día 1 del mes siguiente; un mes que no completó jamás
 * suena (silencio, no "a medias").
 */
/*
 * N7 · "Encontré algo en tus semanas": cuando el writer de memoria de patrones
 * archiva un patrón NUEVO (fresco <24h), agenda el push para la ventana elegida,
 * con destino Órbita Mes. `fresh=false` cancela (self-healing): cuando la usuaria
 * entra a Órbita y lo ve, el flag caduca y el push muere solo. El reposo de 14d
 * del writer evita spam (a lo más 1 push por patrón cada 14 días).
 */
export function useOrbitPatternInvite(): void {
  const { session } = useSession()
  const uid = session?.user?.id ?? null
  // El loop de descubrimiento (incluido N7) vive en DEV hasta validarse. Fuera de
  // dev, `devOnly=false` → syncOrbitPatternInvite recibe siempre false → cancela
  // cualquier N7 agendado y no agenda nada. Mismo gate que Órbita Mes IA.
  const devOnly = aiEnabledForEmail(session?.user?.email)
  const { data: profile } = useProfile()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined
  const { data: fresh } = useRecentOrbitPattern(uid)

  useEffect(() => {
    if (window === undefined || fresh === undefined) return
    void syncOrbitPatternInvite(window, devOnly && fresh === true)
  }, [window, fresh, devOnly])
}

/*
 * N9 · "Nuevo patrón encontrado": corre el motor de Mes (misma ventana de 90
 * días que Descubre, query cacheada) y agenda el hallazgo importante que toca
 * (finding-push.ts). Guarda la fecha en el registro de 14 días. Gateado a DEV
 * como N7 hasta validarlo en un build: fuera del gate cancela y no agenda.
 */
export function useFindingInvite(): void {
  const { session } = useSession()
  const uid = session?.user?.id ?? null
  const devOnly = aiEnabledForEmail(session?.user?.email)
  const { data: profile } = useProfile()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined
  const { data: signals } = useSignalsHistory(90)
  const targets = useMacroTargets().data
  const ledger = useQuery({
    queryKey: queryKeys.notifications.findingLedger(uid),
    queryFn: () => readFindingLedger(uid!),
    enabled: uid != null,
  })

  useEffect(() => {
    if (window === undefined || signals === undefined || ledger.data === undefined || !uid) return
    const patterns = devOnly
      ? detectMonthPatterns(signals, {
          calorieTarget: targets?.calories ?? null,
          proteinTarget: targets?.protein_g ?? null,
        })
      : []
    const pick = pickFindingToAnnounce(patterns, ledger.data, new Date())
    void (async () => {
      const at = await syncFindingInvite(
        window,
        pick ? { id: pick.id, ...findingPushCopy(pick) } : null,
      )
      if (pick && at && ledger.data[pick.id] !== at.toISOString()) {
        await writeFindingLedgerEntry(uid, pick.id, at.toISOString())
      }
    })()
  }, [window, signals, ledger.data, uid, devOnly, targets?.calories, targets?.protein_g])
}

/*
 * N8 · "tu lectura está lista": cuando la semana en curso ya garantiza que el
 * lunes habrá lectura (≥ días mínimos con comida — monotónico, la promesa no
 * se rompe), agenda el push del lunes con destino /weekly-reading. Lee la
 * MISMA query de señales que Órbita (cacheada, cero fetch extra) y se
 * re-sincroniza al cambiar la semana. DOBLE-gateada como toda la Lectura
 * Semanal (flag + dev): fuera del gate, guaranteed=false → cancela cualquier
 * N8 agendado y no agenda nada.
 */
export function useWeeklyReadingInvite(): void {
  const { session } = useSession()
  const readingOn = WEEKLY_READING_ENABLED && aiEnabledForEmail(session?.user?.email)
  const { data: profile } = useProfile()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined
  const { data: signals, todayIso } = useIsoWeekSignals()

  useEffect(() => {
    if (window === undefined || signals === undefined) return
    const guaranteed = readingOn && weeklyReadingGuaranteed(signals, todayIso)
    void syncWeeklyReadingInvite(window, guaranteed)
  }, [window, signals, todayIso, readingOn])
}

export function useCycleSealInvite(figureComplete: boolean, signLabel: string): void {
  const { data: profile } = useProfile()
  const window = (profile ? (profile.notification_window ?? null) : undefined) as
    | NotificationWindow
    | null
    | undefined

  useEffect(() => {
    if (window === undefined) return
    void syncCycleSealInvite(window, figureComplete, signLabel)
  }, [window, figureComplete, signLabel])
}
