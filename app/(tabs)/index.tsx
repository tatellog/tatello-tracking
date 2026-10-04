import AsyncStorage from '@react-native-async-storage/async-storage'
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LoadingView } from '@/components/LoadingView'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { emitCelebrate } from '@/features/tabs/celebrate-bus'
import {
  consumeWatchCelebration,
  subscribeWatchCelebration,
} from '@/features/tabs/pending-watch-celebration'
import { signName } from '@/features/tabs/zodiac/name'
import { useSession } from '@/hooks/useSession'
import { usePressFeedback } from '@/components/ui/interaction'
import type { BriefContext } from '@/features/brief/api'
import { HomeError } from '@/features/home/components'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import type { Profile } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { NotifyOfferSheet } from '@/features/notifications/components/NotifyOfferSheet'
import { useNotifyOffer } from '@/features/notifications/offer'
import { PatternReveal } from '@/features/patterns'
import type { PatternType } from '@/features/patterns/logic'
import { useCycleSealInvite } from '@/features/notifications/hooks'
import { TransformationReveal, useRevelationOrchestrator } from '@/features/revelations'
import { EmblemFramePreloader, TuEmblemaModal, useTransformProgress } from '@/features/emblem'
import { useRecentWorkoutDates } from '@/features/progress/hooks'
import { useRestToday, useSetRestForDate, useSetRestToday } from '@/features/rest/hooks'
import { useSleepLog } from '@/features/sleep/hooks'
import { SmartwatchRow } from '@/features/wearables/components/SmartwatchRow'
import { WearableInviteLine } from '@/features/wearables/components/WearableInviteLine'
import {
  useAppleHealthSyncNow,
  useHealthSummary,
  useScaleBadge,
  useScaleConnection,
} from '@/features/wearables/hooks'
import { wearableDayFacts } from '@/features/wearables/recovery'
import { workoutOfDay } from '@/features/wearables/workout-insights'
import { earlyReading } from '@/features/orbit/early-readings'
import { useSignalsHistory, useTodaySignals, useTotalSignalDays } from '@/features/orbit/hooks'
import { useFirstStarCeremony } from '@/features/tabs/first-star'
import { useWaterToday } from '@/features/water/hooks'
import { ScrollPauseContext } from '@/features/orbit/useScreenActive'
import { useBriefContext } from '@/features/brief/hooks'
import { setActiveLogDate, subscribeReturnToToday } from '@/features/tabs/active-log-date'
import {
  consumeCalendarDay,
  subscribeCalendarDayRequest,
} from '@/features/tabs/pending-calendar-day'
import {
  useSetWorkoutTypeToday,
  useToggleWorkoutForDate,
  useToggleWorkoutToday,
  useWorkoutTypeToday,
} from '@/features/streak/hooks'
import { track } from '@/lib/analytics'
import { HERO_ALIVE_ENABLED } from '@/lib/featureFlags'
import {
  CoachLine,
  DayCheckIn,
  RestMessage,
  type DayState,
  type WorkoutTypeId,
  LunarConstellation,
  MacroRings,
  useHeroReaction,
  SectionHeader,
  SkyBackground,
  SleepCheckIn,
  TabHeader,
  TodayMealLog,
  TuDiaCard,
} from '@/features/tabs/components'
import { checkInTurn } from '@/features/tabs/checkin-turn'
import { useLocalHour } from '@/features/tabs/use-local-hour'
import { buildMonthGrid } from '@/features/tabs/components/constellation/data/month-grid'
import { namedStarProgress } from '@/features/tabs/components/constellation/data/derive-progress'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { queryKeys } from '@/lib/queryKeys'
import { userTimezone } from '@/lib/time'
import { colors } from '@/theme'

/*
 * The commit haptic — a designed two-beat "phrase", not a tick:
 *   trained  → Medium impact ("it clicked in") + a Success
 *              notification 90 ms later ("it landed, and it mattered")
 *   backfill → a single Medium impact (marking a past day is a solid
 *              confirmation, but not today's live ritual)
 *   rested   → a soft Light impact — rest is valid, but a Success
 *              cue would mis-signal it as a "win"
 * Owned here (the action handlers) rather than in DayCheckIn or the
 * constellation, so the body's reward fires with the user's choice.
 */
/** El anillo dorado del arte del emblema, como fracción del lado del lienzo. */
const RING_CY = 0.505
const RING_R = 0.405
/** Primera medición del emblema; luego se re-mide hasta que quede quieto. */
const CELEBRATE_SETTLE_MS = 200

function playCommitHaptic(kind: 'trained' | 'backfill' | 'rested') {
  if (kind === 'rested') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    return
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  if (kind === 'trained') {
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }, 90)
  }
}

function makeEnter(cadence: Cadence) {
  if (cadence === 'reduced') return (_d: number) => FadeIn.duration(220)
  return (d: number) => FadeInDown.duration(380).delay(d).springify().damping(18)
}

export default function TodayScreen() {
  return (
    <ErrorBoundary screen="hoy">
      <TodayBody />
    </ErrorBoundary>
  )
}

function TodayBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'hoy' })
    }, []),
  )
  const brief = useHomeBrief()
  const cadence = useHomeCadence()
  // Profile is also gated here (used to be inside TodayContent).
  // If brief hits cache instantly but profile is still over-the-wire,
  // the header would briefly render with the fallback "tú" greeting
  // and then update to the real name mid-entering-animation —
  // causing a visible text overlap glitch. Gating both together
  // keeps the loading skeleton up until ALL the data the first
  // paint needs is settled.
  const profile = useProfile()
  useDayRollover(brief.data?.date)

  if (brief.isError && !brief.data) return <HomeError onRetry={brief.refetch} />

  if (brief.isLoading || !brief.data || cadence == null || profile.isLoading) {
    return (
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </View>
    )
  }

  return <TodayContent ctx={brief.data} cadence={cadence} profile={profile.data ?? null} />
}

type ContentProps = {
  ctx: BriefContext
  cadence: Cadence
  profile: Profile | null
}

function TodayContent({ ctx, cadence, profile }: ContentProps) {
  const qc = useQueryClient()
  const router = useRouter()
  // El param `slide` es el deep-link desde Órbita ("no apareció → regístralo"):
  // 'sleep' abre la pregunta de sueño arriba; 'macros' / 'cycle' bajan a los
  // anillos; 'meals' a las comidas.
  const { slide: slideParam } = useLocalSearchParams<{ slide?: string }>()

  const toggleToday = useToggleWorkoutToday()
  const toggleForDate = useToggleWorkoutForDate()
  const setWorkoutType = useSetWorkoutTypeToday()

  // ── Modo "ver día": Hoy puede mostrar CUALQUIER día, no solo hoy. El día
  // visto es `selectedDate` (lo setean el strip y el "Editar día" de Progreso).
  // Su contexto COMPLETO (macros/comidas/entrené/ánimo…) viene del mismo brief,
  // ahora parametrizado por fecha; las secciones del día (universo, slides,
  // comidas) leen `vctx`. La constelación/mes/racha siguen con `ctx` (hoy real),
  // así nada de "hoy" se rompe al navegar al pasado.
  const [selectedDate, setSelectedDate] = useState<string>(ctx.date)
  const viewingPast = selectedDate !== ctx.date
  const viewedBriefQ = useBriefContext(viewingPast ? selectedDate : undefined)
  const vctx: BriefContext = viewingPast ? (viewedBriefQ.data ?? ctx) : ctx

  // Rest + estado del día siguen al día VISTO (selectedDate), no a hoy.
  const restQuery = useRestToday(selectedDate)
  const setRest = useSetRestToday(selectedDate)
  const setRestForDate = useSetRestForDate()
  const restedToday = restQuery.data ?? false

  // Mientras Hoy esté viendo un día PASADO, el botón Registrar (y las pantallas
  // de captura de comida) escriben a ESE día. Es un effect PLANO, no de foco:
  // navegar a capture-meal/scan-meal hace blur de Hoy, y un focus-effect lo
  // limpiaría justo antes de que la captura lea la fecha. Al volver a hoy
  // (viewingPast=false) se limpia a null.
  useEffect(() => {
    setActiveLogDate(viewingPast ? selectedDate : null)
  }, [viewingPast, selectedDate])
  // La pill global (en el tab bar) pide "volver a hoy" desde cualquier tab.
  useEffect(() => subscribeReturnToToday(() => setSelectedDate(ctx.date)), [ctx.date])

  const reducedMotion = useReducedMotion()
  // True for the duration of the reward animation. Pauses the constellation's
  // AMBIENT loops (twinkle/drift/breath) so the UI thread is free for the
  // star ignition + the fireworks Lottie + the Skia flash that all fire at
  // once on commit — without it they competed and the reward played janky.
  // The ignition itself is independent of `paused`, so the star still lights.
  const [celebrating, setCelebrating] = useState(false)
  // Safety backstop — if onAnimationFinish never arrives (unmount mid-play,
  // a Lottie that silently stalls), un-pause the constellation anyway so it
  // can't get stuck frozen. The fireworks run well under 4 s at speed 0.6.
  useEffect(() => {
    if (!celebrating) return
    const id = setTimeout(() => setCelebrating(false), 4000)
    return () => clearTimeout(id)
  }, [celebrating])

  // La celebración de "Entrené" vive DENTRO de la constelación (SparkVortex,
  // oct 2026): reemplazó a los fuegos Lottie y al flash dorado full-screen.

  // Pause the constellation's animation loops while the page is actively
  // scrolling so the UI thread isn't split between scroll frames and the
  // SVG/Skia repaint — kills the scroll jank. A debounced idle timer flips it
  // back on ~140 ms after the last scroll event (covers drag + momentum), so
  // the figure freezes for the drag and resumes on release (imperceptible).
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pausa la constelación SOLO en los límites del gesto (inicio de drag /
  // fin de momentum), no en un callback de 60 Hz. Un `onScroll` con
  // scrollEventThrottle=16 obligaba al JS thread a recibir ~60 eventos/s
  // durante el scroll — justo cuando más lo necesitas libre — y solo se
  // usaba para detectar inicio/fin. Los eventos de límite dan eso con cero
  // trabajo por frame. (begin: drag o momentum; end: drag o momentum,
  // debounced 140 ms para cubrir el hand-off drag→momentum.)
  const beginScroll = useCallback(() => {
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    setIsScrolling((s) => (s ? s : true))
  }, [])
  const endScroll = useCallback(() => {
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => setIsScrolling(false), 140)
  }, [])

  const scrollRef = useRef<ScrollView>(null)
  // Offsets de las secciones a las que llega un deep-link desde Órbita
  // ("Todavía no vimos → registrar"): los anillos de macros y las comidas.
  const macrosY = useRef(0)
  const mealsY = useRef(0)

  // Las dos filas del check-in (entreno / sueño): la usuaria puede abrir una
  // ("cambiar" / "anotar") o cerrarla ("Listo" / "Después"); null = lo decide
  // la hora (checkInTurn). Abrir una cierra la otra: una pregunta viva a la
  // vez. Se resetean al cambiar de día visto. `sleepTouched` cubre el hueco
  // entre anotar y que la query traiga la fila.
  const [workoutOpen, setWorkoutOpen] = useState<boolean | null>(null)
  const [sleepOpen, setSleepOpen] = useState<boolean | null>(null)
  const [sleepTouched, setSleepTouched] = useState(false)
  useEffect(() => {
    setWorkoutOpen(null)
    setSleepOpen(null)
    setSleepTouched(false)
  }, [selectedDate])
  const openWorkout = () => {
    setWorkoutOpen(true)
    setSleepOpen((v) => (v === true ? false : v))
  }
  const openSleep = () => {
    setSleepOpen(true)
    setWorkoutOpen((v) => (v === true ? false : v))
  }

  // Deep-link desde Órbita: 'sleep' abre la pregunta arriba (y sube); el resto
  // BAJA la página a su sección. Se limpia el param al terminar para que volver
  // a tocar el mismo chip vuelva a enfocar.
  useEffect(() => {
    if (!slideParam) return
    if (slideParam === 'sleep') openSleep()
    const targetY = slideParam === 'meals' ? mealsY : slideParam === 'sleep' ? null : macrosY
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: targetY ? Math.max(0, targetY.current - 80) : 0,
        animated: true,
      })
      router.setParams({ slide: undefined })
    }, 260)
    return () => clearTimeout(id)
  }, [slideParam, router])
  // Llegada desde "Editar día →" (Historia de Progreso): pone Hoy en modo "ver
  // día" para esa fecha y sube al inicio, donde ahora vive TODO el día (universo,
  // macros, comidas reflejan el día visto). El banner de arriba avisa.
  useEffect(() => {
    const handle = (date: string) => {
      setSelectedDate(date)
      // Beat de ~140ms antes del salto: tu ultima imagen abajo es "elegi este dia"
      // (el ring resaltado + la pill), y la primera arriba es "y aqui esta completo".
      setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 140)
    }
    const pendingDate = consumeCalendarDay()
    if (pendingDate) handle(pendingDate)
    return subscribeCalendarDayRequest(handle)
  }, [])
  // The constellation's pause is driven as a SharedValue, NOT the `paused`
  // boolean it used to take: a boolean prop re-rendered the whole heavy
  // constellation on every scroll start/stop and every reward, and that
  // re-render repainted its SVG + Skia layers for a frame → "el emblema
  // brinca". Mirroring the JS flags into a SharedValue keeps the prop ref
  // stable (no re-render) while the loops still pause on the UI thread.
  // INVARIANT: this ref must stay stable (same object) for the lifetime of
  // TodayContent — useConstellationClocks cancels + restarts all 3 clocks if it
  // changes, which would flash the figure. useSharedValue guarantees that.
  const constellationPaused = useSharedValue(0)
  useEffect(() => {
    constellationPaused.value = isScrolling || celebrating ? 1 : 0
  }, [isScrolling, celebrating, constellationPaused])
  // Hero vivo (V-13): el emblema reacciona a cada registro exitoso (comida /
  // agua / ánimo / sueño) que pase por React Query. Sin flag o con
  // reduce-motion no se suscribe a nada.
  const heroReaction = useHeroReaction(HERO_ALIVE_ENABLED && !reducedMotion)
  const todayIsoLocal = ctx.date

  // Una sola lectura de workouts (45 días) alimenta tanto el grid del mes
  // como la tira de días: los 45 días SIEMPRE contienen el mes actual
  // completo (45 ≥ 31), así que el mes se deriva client-side filtrando por
  // prefijo YYYY-MM en vez de pegarle una segunda vez a Supabase.
  const stripWorkouts = useRecentWorkoutDates(45)
  const monthPrefix = todayIsoLocal.slice(0, 7)
  const monthWorkoutDates = useMemo(
    () => (stripWorkouts.data ?? []).filter((d) => d.startsWith(monthPrefix)),
    [stripWorkouts.data, monthPrefix],
  )
  // Mecánica A (retention-mechanics-spec): CUALQUIER registro del día
  // enciende su estrella — comida, agua, sueño, ánimo, entreno o descanso —
  // no solo «Entrené». daily_signals ya agrega todas las señales por día;
  // los workouts se unen aparte porque el registro de hoy puede no estar
  // aún en la view cacheada. Solo SUMA días (nunca apaga uno encendido).
  const monthSignals = useSignalsHistory(45)
  const monthLitDates = useMemo(() => {
    const days = new Set(monthWorkoutDates)
    for (const r of monthSignals.data ?? []) {
      if (r.day != null && r.day.startsWith(monthPrefix)) days.add(r.day)
    }
    return Array.from(days)
  }, [monthWorkoutDates, monthSignals.data, monthPrefix])
  // La micro-lectura del cierre — una observación real del motor (early-
  // readings) como recompensa VARIABLE de la noche: cada cierre puede decir
  // algo distinto de ELLA. Reusa monthSignals (cero fetch extra); null si
  // no hay nada honesto que decir (la card simplemente omite la línea).
  const closeReading = useMemo(
    () => earlyReading(monthSignals.data ?? [], todayIsoLocal)?.text ?? null,
    [monthSignals.data, todayIsoLocal],
  )
  // Hoy en vivo: la señal de hoy puede tardar hasta 60 s en la view; los
  // flags frescos (entreno / comidas / ánimo / agua) encienden al instante.
  const todaySignals = useTodaySignals()
  const todayWater = useWaterToday(todayIsoLocal)
  const todayHasRegistro =
    ctx.today_workout_completed ||
    ctx.meal_count_today > 0 ||
    ctx.latest_mood?.checkin_date === todayIsoLocal ||
    (todayWater.data ?? 0) > 0 ||
    // «Descansé» es camino de primera clase a la estrella (restQuery sigue al
    // día visto; solo cuenta si el día visto es hoy).
    (restQuery.data === true && selectedDate === todayIsoLocal) ||
    todaySignals.data != null
  const month = useMemo(() => {
    const m = buildMonthGrid(todayIsoLocal, monthLitDates)
    if (todayHasRegistro && m.todayIdx >= 0 && !m.grid[m.todayIdx]) {
      m.grid[m.todayIdx] = true
      m.cells[m.todayIdx]!.trained = true
      m.trainedThisMonth += 1
    }
    return m
  }, [todayIsoLocal, monthLitDates, todayHasRegistro])

  // Micro-ceremonia de la PRIMERA estrella de la vida de la usuaria: haptic +
  // fuegos sobre la constelación + línea del coach. Si la primera acción fue
  // «Entrené», su celebración propia ya corre — no doblamos el Lottie, la
  // línea basta. Una sola vez, persistido (useFirstStarCeremony).
  // "X días en órbita" — acumulado de por vida de días con señal (decisión
  // dueña jul 2026: alineado a la mecánica "cualquier registro enciende";
  // reemplaza a la racha consecutiva ctx.streak_days, que era loss-aversion).
  // El +1 en vivo: hoy cuenta apenas registra, aunque la view aún no lo traiga.
  const totalSignalDays = useTotalSignalDays()
  const daysInOrbit =
    (totalSignalDays.data ?? 0) + (todayHasRegistro && todaySignals.data == null ? 1 : 0)

  const firstStarFired = useFirstStarCeremony(todayHasRegistro)
  const firstStarPlayed = useRef(false)
  useEffect(() => {
    if (!firstStarFired || firstStarPlayed.current) return
    firstStarPlayed.current = true
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    if (!celebrating) fireCelebration('Tu primera estrella', `Aquí empieza tu ${signProper}.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstStarFired, reducedMotion, celebrating])

  const trainedThisMonth = month.trainedThisMonth
  // El día en que se encendió la última estrella de la figura: la fecha del
  // logro que muestra "Tu {signo}" ("Completaste tu Escorpio el 19 de sep…").
  const MONTHS_ES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  // "2 de junio" — para el banner de modo ver día.
  const viewingLabel = `${Number(selectedDate.slice(8, 10))} de ${MONTHS_ES[Number(selectedDate.slice(5, 7)) - 1] ?? ''}`

  const sign = useMemo(() => zodiacFromDate(profile?.date_of_birth), [profile?.date_of_birth])
  const signLabel = ZODIAC[sign].label
  const signProper = signName(sign)

  // La celebración full-screen (RingCelebration, en el layout de tabs): nace
  // del anillo dorado del emblema (centrado en su lienzo cuadrado, radio 40.5 %
  // del ancho) y el oro regresa a la estrella del corazón, que reporta la
  // constelación (onHeartLayout). Se mide DESPUÉS de que el check-in se colapsa
  // al responder: medir en el tap dejaba la corona ~30 pt abajo del emblema,
  // que sube cuando los botones pasan a una sola línea.
  const constellationRef = useRef<View>(null)
  const heartRef = useRef<{ x: number; y: number; canvas: number } | null>(null)
  const fireCelebration = (title: string, subtitle?: string) => {
    if (reducedMotion) return
    setCelebrating(true)
    // Mide hasta que el emblema quede QUIETO: al tocar "Entrené" el check-in se
    // colapsa con animación y el emblema sube un rato; medir a tiempo fijo
    // dejaba la corona desfasada (iPhone). Dos lecturas iguales seguidas =
    // quieto. También cubre el cold start desde la notificación (la
    // constelación aún no existe en los primeros intentos).
    let last: number | null = null
    const attempt = (left: number) => {
      const node = constellationRef.current
      if (!node) {
        if (left > 0) setTimeout(() => attempt(left - 1), 120)
        return
      }
      node.measureInWindow((x, y, w) => {
        const stable = w > 0 && last != null && Math.abs(last - y) < 0.5
        if (!stable && left > 0) {
          if (w > 0) last = y
          setTimeout(() => attempt(left - 1), 120)
          return
        }
        if (!w) return
        const heart = heartRef.current
        const side = heart?.canvas ?? w
        const ox = x + (w - side) / 2
        const cx = ox + side / 2
        const cy = y + side * RING_CY
        emitCelebrate({
          cx,
          cy,
          r: side * RING_R,
          tx: heart ? ox + heart.x : cx,
          ty: heart ? y + heart.y : cy,
          title,
          subtitle,
        })
      })
    }
    setTimeout(() => attempt(25), CELEBRATE_SETTLE_MS)
  }

  // Orquestador de Revelaciones — única fuente de momentos full-screen en Hoy
  // (Regreso > Transformación > Patrón). Reemplaza al usePatternDetection
  // suelto: ahora T2/T3 + el nuevo T1 viven en un solo sistema.
  const { revelation, dismiss: dismissRevelation } = useRevelationOrchestrator(signLabel)
  // El % actual del emblema — la Revelación de Regreso lo muestra "donde lo
  // dejaste" (cacheado por useTransformProgress; misma fuente que el hero).
  const { progress: emblemProgress } = useTransformProgress()
  const figureCount = ZODIAC[sign].stars.length + ZODIAC[sign].lines.length

  // N5 · sello del ciclo: en cuanto la figura del mes se completa (misma
  // fuente trained/figureCount que pinta el hero), el anuncio queda
  // agendado para el día 1 del mes siguiente en la ventana elegida.
  useCycleSealInvite(figureCount > 0 && trainedThisMonth >= figureCount, signLabel)

  // "Tu {signo}" — el modal de progreso de la constelación, abierto desde el
  // hero compacto. % y conteo salen de la MISMA fuente (trained/figureCount)
  // que pinta el hero, así nunca se contradicen.
  const [tuEmblemaOpen, setTuEmblemaOpen] = useState(false)
  // Avisos en contexto (dueña 26 sep 2026): se ofrecen al guardar la primera
  // comida, nunca en el onboarding. Espera a que Hoy esté libre de ceremonias.
  const notifyOffer = useNotifyOffer(
    'meal',
    !viewingPast && ctx.meal_count_today >= 1 && !revelation && !tuEmblemaOpen,
  )
  const heroPct = figureCount > 0 ? Math.round((trainedThisMonth / figureCount) * 100) : 0
  const heroPress = usePressFeedback()
  // Estrellas con nombre ya encendidas + la que sigue — derivadas de la
  // secuencia REAL de la constelación (las líneas se intercalan), así el modal
  // nunca se contradice con la figura animada. Alimentan "lo que ya despertó"
  // y "la que sigue".
  const { lit: litStars, next: nextStar } = useMemo(
    () => namedStarProgress(ZODIAC[sign], trainedThisMonth),
    [sign, trainedThisMonth],
  )

  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const greetingName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  // V-15 Smart Recovery: lo que el reloj ya trajo del día VISTO (sin manual
  // encima). Hoy sale de todaySignals (fresco, invalidado por el sync); un día
  // pasado, de la historia de 45 días ya cargada (cero fetch extra). El manual
  // de sueño del día permite inferir la procedencia con la view vieja.
  const viewedSignals =
    selectedDate === todayIsoLocal
      ? todaySignals.data
      : (monthSignals.data ?? []).find((r) => r.day === selectedDate)
  const manualSleep = useSleepLog(selectedDate)
  const wearable = wearableDayFacts(viewedSignals, {
    manualSleepMinutes: manualSleep.data?.duration_minutes ?? null,
  })
  // Entreno sellado por el reloj: sin registro manual, sin descanso marcado.
  const trainedByWearable =
    !vctx.today_workout_completed && !restedToday && wearable.workout != null
  // daily_signals solo trae el TOTAL del día; las sesiones (Bici, Fuerza…)
  // salen de wearable_workouts para que la fila diga qué hiciste.
  const dayHealth = useHealthSummary(selectedDate, selectedDate)
  const daySessions = dayHealth.data
    ? workoutOfDay(dayHealth.data.workouts, selectedDate, userTimezone())
    : null

  // El entreno llegó DEL RELOJ con Hoy abierto (sync de apertura o en vivo):
  // misma celebración que tocar "Entrené" (dueña 30 sep 2026). Una vez por día
  // y por usuaria (persistido: reabrir la app no la repite). Si llega con Hoy
  // tapado, espera a que vuelva al frente. Solo la TRANSICIÓN celebra: si al
  // montar ya venía del reloj, no hay nada nuevo que festejar.
  const watchTrainedToday = !viewingPast && trainedByWearable
  const prevWatchTrained = useRef(watchTrainedToday)
  const pendingWatchCelebration = useRef(false)
  const hoyFocused = useIsFocused()
  const uidForCelebration = useSession().session?.user?.id ?? 'anon'
  const celebrateWatchWorkout = () => {
    playCommitHaptic('trained')
    fireCelebration('Tu reloj trajo tu entreno', `Una luz más en tu ${signProper}.`)
    track('workout_celebrated', { source: 'wearable' })
  }
  // Una sola celebración del reloj por día: la llegada en vivo (transición) y
  // el tap de "Entreno registrado" pueden coincidir al abrir la app. El tap es
  // intención explícita: celebra aunque otra sesión ya lo haya hecho hoy;
  // nunca dos veces en la misma sesión.
  const celebratedDayRef = useRef<string | null>(null)
  const celebrateWatchOnce = async (fromTap: boolean) => {
    if (celebratedDayRef.current === todayIsoLocal) return
    const key = `stelar.watch-workout-celebrated:${uidForCelebration}:${todayIsoLocal}`
    if (!fromTap) {
      const done = await AsyncStorage.getItem(key).catch(() => null)
      if (done) return
    }
    celebratedDayRef.current = todayIsoLocal
    await AsyncStorage.setItem(key, '1').catch(() => {})
    if (hoyFocused) celebrateWatchWorkout()
    else pendingWatchCelebration.current = true
  }
  useEffect(() => {
    const was = prevWatchTrained.current
    prevWatchTrained.current = watchTrainedToday
    if (!watchTrainedToday || was) return
    void celebrateWatchOnce(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchTrainedToday])
  // El tap de la notificación "Entreno registrado" (buzón: puede llegar antes
  // de que Hoy exista, en un cold start desde la notificación).
  useEffect(() => {
    const handle = (date: string) => {
      if (date === todayIsoLocal) void celebrateWatchOnce(true)
    }
    const pending = consumeWatchCelebration()
    if (pending) handle(pending)
    return subscribeWatchCelebration(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayIsoLocal])
  useEffect(() => {
    if (!hoyFocused || !pendingWatchCelebration.current) return
    pendingWatchCelebration.current = false
    celebrateWatchWorkout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoyFocused])

  // Modo confirmación (spec §9): lo que el reloj ya trajo NO se pregunta. Las
  // filas de entreno y sueño nacen respondidas, con la misma gramática del
  // camino manual (misma estrella), y una sola firma debajo dice qué vino del
  // reloj y hace cuánto. "cambiar" por fila corrige; manual gana.
  const sleepFromWearable = wearable.sleep != null
  const anyFromWearable = trainedByWearable || sleepFromWearable
  // "ajustar" en el eyebrow del reloj abre a la vez lo que vino del reloj
  // (tipo de entreno, horas de sueño); cada bloque cierra por su cuenta
  // (Cancelar · Listo), así que el ajuste se sigue por bloque.
  const [adjustWorkout, setAdjustWorkout] = useState(false)
  const [adjustSleep, setAdjustSleep] = useState(false)
  useEffect(() => {
    setAdjustWorkout(false)
    setAdjustSleep(false)
  }, [selectedDate])

  const hour = useLocalHour()
  const hasSleep =
    manualSleep.data?.duration_minutes != null || wearable.sleep != null || sleepTouched

  // Báscula (spec §9): ícono en la cabecera solo cuando Salud existe en este
  // build; el punto avisa de una lectura nueva. Nunca muestra el número.
  const scaleConn = useScaleConnection()
  // Jalar Hoy hacia abajo lee Salud AHORA (sin esperar el intervalo del sync
  // de fondo): el sueño de anoche llega cuando Garmin Connect sincroniza.
  const syncHealthNow = useAppleHealthSyncNow()
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = async (): Promise<void> => {
    setRefreshing(true)
    try {
      await syncHealthNow()
    } finally {
      setRefreshing(false)
    }
  }
  const scaleBadge = useScaleBadge()

  // Criterio de éxito V-15 ("cero preguntas por datos que ya llegaron"): se
  // instrumenta UNA vez por día lo que el reloj pre-llenó en Hoy.
  const prefilledTracked = useRef<string | null>(null)
  useEffect(() => {
    if (viewingPast) return
    const workout = trainedByWearable
    const sleep = wearable.sleep != null
    const water = wearable.water != null
    if (!workout && !sleep && !water) return
    const key = `${todayIsoLocal}:${workout ? 'w' : ''}${sleep ? 's' : ''}${water ? 'a' : ''}`
    if (prefilledTracked.current === key) return
    prefilledTracked.current = key
    track('wearable_prefilled', { source: 'apple_health', workout, sleep, water })
  }, [viewingPast, trainedByWearable, wearable.sleep, wearable.water, todayIsoLocal])

  // El estado del toggle es el del día VISTO (vctx), no el de hoy. El reloj
  // sella "entrenaste" igual que el manual: Stelar no pregunta lo que ya llegó.
  const dayState: DayState = vctx.today_workout_completed
    ? 'trained'
    : restedToday
      ? 'rested'
      : trainedByWearable
        ? 'trained'
        : 'undecided'

  // La voz del coach bajo el cielo: una sola frase. Día 1 = la primera estrella;
  // con registro de hoy, la frase cierra nombrando lo de mañana (open loop por
  // deseo, nunca racha). Se calcula aquí para que el JSX quede en una línea.
  const coachCopy: CoachCopy = (() => {
    if (firstStarFired) {
      return { before: 'Tu primera estrella. Así ', emphasis: 'empieza', after: ' un cielo.' }
    }
    const morning = !viewingPast && hour < 12
    const base = getCoachCopy(
      trainedThisMonth,
      signLabel,
      dayState === 'trained',
      sign,
      morning,
      // V-15: la noche ya llegó del reloj → el beat matinal lo reconoce.
      !viewingPast && sleepFromWearable,
    )
    if (!todayHasRegistro || viewingPast || morning) return base
    const tail =
      trainedThisMonth >= figureCount
        ? null // la luz extra ya la dice el contador de la constelación
        : trainedThisMonth + 1 >= figureCount
          ? 'Mañana completas tu figura.'
          : (() => {
              const next = pickStarForCount(sign, trainedThisMonth + 1)
              return next ? `Mañana, ${next.name}.` : null
            })()
    return tail ? { ...base, after: `${base.after.replace(/\s*$/, '')} ${tail}` } : base
  })()

  // Tipo de entreno de HOY (para la fila colapsada y el chip activo). Solo
  // consulta cuando hoy ya está entrenado; en modo "ver día" viene del brief.
  const workoutTypeQ = useWorkoutTypeToday(!viewingPast && dayState === 'trained')

  // El turno del check-in (decisión dueña sep 2026): dos filas fijas, UNA
  // pregunta viva a la vez, la hora decide cuál (mañana: sueño; desde el
  // mediodía: entreno, y al responderlo el sueño abre una vez si sigue
  // pendiente). Sellado por el reloj cuenta como respondido.
  const turn = checkInTurn({
    hour,
    workoutAnswered: dayState !== 'undecided',
    sleepAnswered: hasSleep,
    workoutOpen,
    sleepOpen,
    past: viewingPast,
  })

  // "Un tap dice todo": el tipo responde entrené + de qué en un solo gesto.
  const handleTrain = (type: WorkoutTypeId) => {
    track('workout_type_selected', { type })
    // Día PASADO: backfill sin celebración. GUARD — la constelación NO retrocede
    // (memoria immutable-vs-recalculable): una estrella ya encendida queda
    // SELLADA; el backfill solo ENCIENDE. Solo persiste + haptic suave.
    if (viewingPast) {
      if (vctx.today_workout_completed) return
      setRestForDate.mutate({ date: selectedDate, rested: false })
      toggleForDate.mutate({ date: selectedDate, complete: true, type })
      playCommitHaptic('backfill')
      track('calendar_day_marked', { date: selectedDate, status: 'trained', source: 'calendar' })
      return
    }
    const alreadyTrained = ctx.today_workout_completed || trainedByWearable
    if (restedToday) setRest.mutate(false)
    if (!ctx.today_workout_completed) toggleToday.mutate(true)
    // Upsert: fija el tipo aunque el insert de arriba siga en vuelo.
    setWorkoutType.mutate(type)
    // Cambiar solo el tipo de un día ya entrenado no vuelve a celebrar.
    if (alreadyTrained) return
    const wasFirstDay = isFirstDay
    playCommitHaptic('trained')
    // La corona de chispas del anillo, a pantalla completa (RingCelebration).
    fireCelebration('Entrenaste hoy', `Una luz más en tu ${signProper}.`)
    if (wasFirstDay) {
      qc.invalidateQueries({ queryKey: queryKeys.profile.all })
    }
  }

  const handleRest = () => {
    if (viewingPast) {
      if (vctx.today_workout_completed) return // sellado: nada lo apaga
      toggleForDate.mutate({ date: selectedDate, complete: false })
      setRestForDate.mutate({ date: selectedDate, rested: true })
      playCommitHaptic('rested')
      track('calendar_day_marked', { date: selectedDate, status: 'rested', source: 'calendar' })
      return
    }
    // Descanso no llena estrella; si estaba entrenado a mano lo quitamos (el
    // unmark borra la fila y su tipo; volver a entrenar vuelve a elegir tipo).
    if (ctx.today_workout_completed) toggleToday.mutate(false)
    setRest.mutate(true)
    playCommitHaptic('rested')
  }

  const enter = makeEnter(cadence)

  return (
    // Provide the scroll-pause flag to every useScreenActive() consumer on
    // Hoy — notably SkyBackground's 108-node starfield <Svg>, which otherwise
    // kept twinkling (full SVG repaint 60×/s) DURING the scroll and fought the
    // gesture. Now it freezes while scrolling, like it already does on Órbita.
    <ScrollPauseContext.Provider value={isScrolling}>
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={beginScroll}
            onMomentumScrollBegin={beginScroll}
            onScrollEndDrag={endScroll}
            onMomentumScrollEnd={endScroll}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.niebla}
              />
            }
          >
            <Animated.View entering={enter(40)}>
              <TabHeader
                greeting={`Hola, ${greetingName}.`}
                greetingEmphasis={greetingName}
                scale={
                  scaleConn.available === true
                    ? { hasNew: scaleBadge.hasNew, onPress: () => router.push('/scale') }
                    : null
                }
              />
            </Animated.View>

            {/* El indicador de "modo ver día" ya no vive aquí: es una pill
                GLOBAL sobre el tab bar (ViewingDayPill), visible en todos los
                tabs. */}

            {/* El momento de Regreso (3+ días fuera) ahora es la Revelación
                de Regreso full-screen del orquestador (T2) — el ReturnMoment
                inline se retiró para no duplicar el momento (spec Decisión #3). */}

            <Animated.View entering={enter(120)}>
              <DayCheckIn
                // Resetea el hold interno al navegar entre días.
                key={selectedDate}
                state={dayState}
                // "ajustar" abre la edición también en día de descanso.
                mode={adjustWorkout ? 'ask' : turn.workout}
                onTrain={handleTrain}
                onRest={handleRest}
                onOpen={openWorkout}
                onClose={() => {
                  setWorkoutOpen(false)
                  setAdjustWorkout(false)
                }}
                label={viewingPast ? viewingLabel : undefined}
                question={viewingPast ? '¿Entrenaste este día?' : '¿Entrenaste hoy?'}
                locked={viewingPast && (vctx.today_workout_completed || trainedByWearable)}
                // Sin fila manual, el tipo viene del reloj (fuerza/cardio/caminata/otro).
                // Un día pasado sin fila manual también dice su tipo (el del reloj).
                workoutType={
                  viewingPast
                    ? trainedByWearable
                      ? (wearable.workout?.type ?? null)
                      : undefined
                    : (workoutTypeQ.data ?? wearable.workout?.type ?? null)
                }
                wearable={
                  trainedByWearable && wearable.workout
                    ? { minutes: wearable.workout.minutes, kcal: wearable.workout.kcal }
                    : null
                }
                sessions={trainedByWearable ? (daySessions?.list ?? null) : null}
                onDetail={() =>
                  router.push({ pathname: '/workout-day', params: { date: selectedDate } })
                }
                // Con algo del reloj, UN solo "ajustar" en esta fila abre las dos
                // cosas (entreno/descanso y horas); ya no hay encabezado del
                // reloj ni un "cambiar" por fila (dueña 28 sep 2026).
                onAdjust={
                  anyFromWearable && !(adjustWorkout || adjustSleep)
                    ? () => {
                        setAdjustWorkout(true)
                        setAdjustSleep(sleepFromWearable)
                      }
                    : undefined
                }
                restMessageOutside
                saveFailed={
                  toggleToday.isError ||
                  setRest.isError ||
                  toggleForDate.isError ||
                  setRestForDate.isError
                }
              />
              {/* La fila del sueño, siempre presente (pregunta, línea quieta o
                  respondida). */}
              {
                <SleepCheckIn
                  key={`sleep-${selectedDate}`}
                  date={selectedDate}
                  mode={adjustSleep && sleepFromWearable ? 'ask' : turn.sleep}
                  wearableMinutes={wearable.sleep?.minutes ?? null}
                  past={viewingPast}
                  onDetail={() =>
                    router.push({ pathname: '/sleep', params: { date: selectedDate } })
                  }
                  onOpen={openSleep}
                  onClose={(touched) => {
                    if (touched) setSleepTouched(true)
                    setSleepOpen(false)
                    setAdjustSleep(false)
                  }}
                />
              }
              {/* La voz del coach cierra el bloque, siempre al final. */}
              {dayState === 'rested' && !adjustWorkout && turn.workout !== 'ask' ? (
                <RestMessage />
              ) : null}
              {/* Invitación contextual (spec wearables §5): solo con el día
                  respondido, el sueño ya no preguntando, y el canal disponible
                  pero no conectado. */}
              {!viewingPast &&
              dayState !== 'undecided' &&
              !anyFromWearable &&
              turn.sleep !== 'ask' ? (
                <WearableInviteLine />
              ) : null}
              {/* Con el reloj conectado, la entrada fija a "Tu smartwatch". */}
              {!viewingPast ? <SmartwatchRow /> : null}
            </Animated.View>

            {/* La constelación va DIRECTO tras el toggle — nada de texto entre
                la acción del día y su consecuencia visible (el cielo crece). El
                título serif "Tu {signo}" y la regla flotante se retiraron: el
                hero es la unidad (figura + progreso + nombre tras el tap), y la
                regla del mecanismo vive en el modal. La figura es tappable:
                abre "Tu {signo}" (press-scale + la pista "toca para ver tus
                estrellas" debajo). */}
            {/* layout: cuando el check-in de arriba cambia de altura (colapso,
                chips), el hero se DESLIZA a su nueva posición en vez de
                brincar en el frame de la celebración. */}
            <Animated.View
              entering={enter(200)}
              layout={reducedMotion ? undefined : LinearTransition.duration(220)}
              style={styles.heroWrap}
            >
              <Pressable
                onPress={() => {
                  heroPress.triggerHaptic()
                  setTuEmblemaOpen(true)
                  track('hoy_constellation_opened', {
                    trained: trainedThisMonth,
                    total: figureCount,
                    pct: heroPct,
                  })
                }}
                onPressIn={heroPress.onPressIn}
                onPressOut={heroPress.onPressOut}
                accessibilityRole="button"
                accessibilityLabel={`Tu ${signLabel}. ${heroPct} por ciento de tu figura, ${trainedThisMonth} de ${figureCount}. Ver tus estrellas`}
              >
                <Animated.View style={[styles.heroInner, heroPress.animatedStyle]}>
                  <View ref={constellationRef} collapsable={false} style={styles.constellationBox}>
                    {/* El progreso lo lleva el contador NATIVO de la
                        constelación ("10 / 19 luces", animado con el commit).
                        Ya no hay barra/conteo duplicado aquí abajo; tocar la
                        figura (press-scale + la pista de abajo) abre el modal. */}
                    <LunarConstellation
                      trained={month.grid}
                      todayIdx={month.todayIdx}
                      target={month.daysInMonth}
                      sign={sign}
                      committed={todayHasRegistro}
                      suppressBurst
                      pausedSV={constellationPaused}
                      reaction={heroReaction}
                      onHeartLayout={(p) => {
                        heartRef.current = p
                      }}
                    />
                  </View>
                </Animated.View>
              </Pressable>
            </Animated.View>

            <Animated.View
              entering={enter(300)}
              layout={reducedMotion ? undefined : LinearTransition.duration(220)}
              style={styles.coachLineWrap}
            >
              {/* UNA sola voz bajo el cielo (dirección de arte sep 2026): la
                  CoachLine absorbe la primera estrella y el gancho de mañana. */}
              <CoachLine align="center" {...coachCopy} />
            </Animated.View>

            {/* "Tu día" — la ÚNICA tarjeta de lectura: de día la lectura sin
                número (V-02), desde las 20:00 el cierre con la cifra, y la
                Lectura Semanal (V-06) cuando hay una sin abrir. Solo para HOY
                (en modo ver-día no hay lectura que dar); sin comida, no existe. */}
            {!viewingPast ? (
              <TuDiaCard
                consumedCalories={ctx.today_macros.calories}
                targetCalories={ctx.targets?.calories}
                mealCount={ctx.meal_count_today}
                closeReading={closeReading}
              />
            ) : null}

            {/* ("Tu universo hoy" se retiró el 25 sep 2026, decisión dueña: segundo
                sistema de progreso que competía con la constelación, contador en
                Hoy y sin efecto en motor ni emblema. El momento de recompensa por
                registro vive en el hero vivo, V-13.) */}

            {/* ── Nivel 3 · Contexto del día e historia ────────────────────
                Lo que la usuaria consulta cuando ya hizo lo principal:
                comidas, macros, y el calendario (historia/editor) al final. */}

            {/* Comidas ANTES que macros (dueña 26 sep 2026): registrar es lo que
                haces; los anillos son el resultado. Con el día vacío, unos
                anillos en cero arriba no decían nada. */}
            <Animated.View
              entering={enter(520)}
              onLayout={(e) => {
                mealsY.current = e.nativeEvent.layout.y
              }}
            >
              <SectionHeader label={viewingPast ? 'Comidas del día' : 'Comidas'} />
            </Animated.View>
            <Animated.View entering={enter(560)}>
              <TodayMealLog
                date={vctx.date}
                onOpenMeal={(id) => router.push({ pathname: '/scan-meal', params: { editId: id } })}
                onAddMeal={() => router.push({ pathname: '/capture-meal' })}
              />
            </Animated.View>
            <Animated.View
              entering={enter(600)}
              onLayout={(e) => {
                macrosY.current = e.nativeEvent.layout.y
              }}
            >
              {/* Los dos anillos, siempre visibles, sin pager: el sueño subió a
                  la pregunta del día y el peso no vive en Hoy. */}
              <MacroRings ctx={vctx} />
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
        {/* El flash dorado full-screen vive global en el (tabs) layout
            (CelebrationOverlay) para cubrir también la tab bar. */}
        {/* "Tu {signo}" — el modal de progreso de la constelación, abierto desde
            el hero. Lenguaje de Revelaciones (blur + emblema correcto de Hoy). */}
        {/* Calienta el caché de RN Image del emblema para que el modal no se
            tarde en su primera apertura (el hero lo pinta en Skia, otro caché). */}
        <EmblemFramePreloader sign={sign} />
        <TuEmblemaModal
          visible={tuEmblemaOpen}
          onClose={() => setTuEmblemaOpen(false)}
          sign={sign}
          signLabel={signLabel}
          trained={trainedThisMonth}
          total={figureCount}
          litStars={litStars}
          nextStar={nextStar}
          daysInOrbit={daysInOrbit}
          completedOn={figureCompletedOn(month.cells, figureCount)}
        />
        <NotifyOfferSheet
          visible={notifyOffer.visible}
          trigger="meal"
          onAccept={notifyOffer.accept}
          onDecline={notifyOffer.decline}
        />
        {/* Revelaciones full-screen — el momento core de Stelar, sobre Hoy.
          El orquestador elige UNA (Regreso > Transformación > Patrón); se
          pinta según su tier: el EMBLEMA para Transformación Y para Regreso
          ("tu cielo te esperó" con tu emblema, no una figura anónima); la
          constelación de PatternReveal solo para los Patrones. */}
        {revelation?.tier === 'transformation' ? (
          <TransformationReveal
            sign={sign}
            threshold={Number(revelation.kind)}
            message={revelation.message}
            onClose={dismissRevelation}
          />
        ) : revelation?.tier === 'return' ? (
          <TransformationReveal
            sign={sign}
            variant="return"
            threshold={emblemProgress}
            message={revelation.message}
            onClose={dismissRevelation}
          />
        ) : revelation ? (
          <PatternReveal
            pattern={{
              id: 'revelation',
              type: revelation.kind as PatternType,
              message: revelation.message,
            }}
            onClose={dismissRevelation}
          />
        ) : null}
      </View>
    </ScrollPauseContext.Provider>
  )
}

type CoachCopy = { before: string; emphasis: string; after: string }

const COACH_PHASE_POOLS: { min: number; lines: CoachCopy[] }[] = [
  {
    min: 22,
    lines: [
      { before: '', emphasis: 'Recta final', after: '. El cielo casi se cierra.' },
      { before: 'Tu ', emphasis: 'constelación', after: ' casi está completa.' },
      { before: 'Faltan pocas estrellas para ', emphasis: 'cerrarla', after: '.' },
      { before: 'Tan cerca que ya casi lo ', emphasis: 'ves entero', after: '.' },
    ],
  },
  {
    min: 15,
    lines: [
      { before: 'Pasaste la mitad. Esto ya es ', emphasis: 'tuyo', after: '.' },
      { before: 'La segunda mitad pesa ', emphasis: 'menos', after: '. Lo notas.' },
      { before: 'Tu cielo está más ', emphasis: 'lleno que vacío', after: '.' },
      { before: 'Lo difícil ya ', emphasis: 'quedó atrás', after: '.' },
    ],
  },
  {
    min: 8,
    lines: [
      { before: 'El cuerpo aprende cuando ', emphasis: 'insistes', after: '.' },
      { before: 'Ya no es esfuerzo. Empieza a ser ', emphasis: 'tuyo', after: '.' },
      { before: 'La constancia se está volviendo ', emphasis: 'gravedad', after: '.' },
    ],
  },
  {
    min: 2,
    lines: [
      { before: 'Tu cuerpo lo está ', emphasis: 'registrando', after: '. Aunque no lo veas aún.' },
      { before: 'Dos, tres, cuatro… ', emphasis: 'un patrón', after: ' empieza a dibujarse.' },
      { before: 'Cada día suma una estrella a tu ', emphasis: 'cielo', after: '.' },
      { before: 'Todavía es frágil. Por eso ', emphasis: 'hoy importa', after: '.' },
    ],
  },
]

function pickStarForCount(sign: ZodiacSign, count: number): { name: string; role: string } | null {
  if (count <= 0) return null
  const named = ZODIAC[sign].stars.filter(
    (s): s is typeof s & { name: string; role: string } =>
      typeof s.name === 'string' && typeof s.role === 'string',
  )
  if (named.length === 0) return null
  const star = named[(count - 1) % named.length]!
  return { name: star.name, role: star.role }
}

function getCoachCopy(
  count: number,
  signLabel: string,
  trainedToday: boolean,
  sign: ZodiacSign,
  morning = false,
  nightFromWatch = false,
): CoachCopy {
  const lower = signLabel.toLowerCase()

  if (count === 28) {
    return { before: `Completaste tu ${lower}. `, emphasis: 'Brillas', after: '.' }
  }
  if (count === 21) {
    return { before: 'Tres semanas. Estás ', emphasis: 'cerca', after: '.' }
  }
  if (count === 14) {
    return { before: 'La ', emphasis: 'mitad atrás', after: '. Sigue.' }
  }
  if (count === 10) {
    return { before: 'Diez. Ya no es casualidad, es ', emphasis: 'constancia', after: '.' }
  }
  if (count === 7) {
    return { before: 'Una semana. Tu cuerpo lo ', emphasis: 'recuerda', after: '.' }
  }
  if (count === 5) {
    return { before: 'Cinco días. Esto ya ', emphasis: 'pesa', after: '.' }
  }
  if (count === 2) {
    return { before: 'Dos. Ya empieza a ser un ', emphasis: 'patrón', after: '.' }
  }
  if (count === 1) {
    return { before: 'Hoy ', emphasis: 'empieza', after: ' algo. Tu cuerpo lo registra.' }
  }

  if (trainedToday) {
    const namedStar = pickStarForCount(sign, count)
    if (namedStar) {
      return {
        before: `Hoy encendiste ${namedStar.name}. `,
        emphasis: namedStar.role,
        after: '.',
      }
    }
    const done: CoachCopy[] = [
      { before: 'Hoy quedó. Una estrella más en tu ', emphasis: lower, after: '.' },
      { before: 'Listo por hoy. Tu cielo ', emphasis: 'creció', after: '.' },
      { before: 'Hoy ', emphasis: 'cuenta', after: '. Tu cuerpo lo registró.' },
      { before: 'Quedó marcado. Una luz ', emphasis: 'más', after: ' en tu figura.' },
    ]
    return done[count % done.length]!
  }

  // El beat matinal — cobra el gancho de anoche ("Mañana: {estrella}"): la
  // mañana siguiente, con el día aún sin responder, la estrella prometida se
  // nombra como invitación, nunca como orden. Cierra el ciclo anticipación →
  // pago de la Mecánica D; sin él, el coach genérico dejaba la promesa fría.
  if (morning) {
    const next = pickStarForCount(sign, count + 1)
    if (next) {
      // V-15: el reloj ya anotó la noche — se reconoce el dato recibido antes
      // de la invitación (microlectura con dato, no relleno).
      const lead = nightFromWatch
        ? 'Tu reloj ya vio tu noche. Hoy se enciende '
        : 'Hoy se enciende '
      return { before: lead, emphasis: next.name, after: ', si tú quieres.' }
    }
  }

  const phase = COACH_PHASE_POOLS.find((p) => count >= p.min)
  if (phase) {
    return phase.lines[count % phase.lines.length] ?? phase.lines[0]!
  }
  return { before: `Tu ${lower} `, emphasis: 'te espera', after: '.' }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    // Aire para la barra flotante: con 48 el último texto quedaba detrás.
    paddingBottom: 140,
  },
  // Hero: la figura grande (full-bleed, como estaba — la dueña la prefiere
  // así, y en chico las líneas se amontonaban) + la barra de progreso debajo,
  // centrada. Sigue siendo tappable (abre el modal).
  // Ritmo 8/16/32/56 (dirección de arte sep 2026): el silencio más grande
  // rodea al cielo. Check-in → hero 32; hero → coach 12; coach → lectura 32.
  heroWrap: {
    alignItems: 'center',
    marginTop: 32,
  },
  heroInner: {
    width: '100%',
  },
  constellationBox: {
    // Sangra a los bordes (como estaba). SIN aspectRatio/alignSelf aquí: la
    // altura la define LunarConstellation por su propio svgWrap cuadrado —
    // forzar aspectRatio en el wrapper medía mal la altura y los elementos de
    // abajo (progreso, coach) se metían DENTRO de la figura.
    marginHorizontal: -20,
  },
  coachLineWrap: {
    marginTop: 12,
    marginBottom: 32,
  },
})

/** "19 de septiembre": el día en que la cuenta del mes alcanzó la figura. */
function figureCompletedOn(
  cells: readonly { date: string; trained: boolean }[],
  figureCount: number,
): string | null {
  if (figureCount <= 0) return null
  let n = 0
  for (const c of cells) {
    if (!c.trained) continue
    n += 1
    if (n === figureCount) {
      const months = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ]
      return `${Number(c.date.slice(8, 10))} de ${months[Number(c.date.slice(5, 7)) - 1] ?? ''}`
    }
  }
  return null
}
