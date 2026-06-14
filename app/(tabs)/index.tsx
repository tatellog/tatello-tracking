import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import LottieView from 'lottie-react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LoadingView } from '@/components/LoadingView'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { BriefContext } from '@/features/brief/api'
import { CelebrateShockwave, HomeError } from '@/features/home/components'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import type { Profile } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { PatternReveal } from '@/features/patterns'
import type { PatternType } from '@/features/patterns/logic'
import { TransformationReveal, useRevelationOrchestrator } from '@/features/revelations'
import { TransformationCard, useTransformProgress } from '@/features/emblem'
import { useRecentWorkoutDates } from '@/features/progress/hooks'
import { useRestToday, useSetRestForDate, useSetRestToday } from '@/features/rest/hooks'
import { ScrollPauseContext } from '@/features/orbit/useScreenActive'
import { subscribeUniverseDetailRequest } from '@/features/tabs/pending-universe-detail'
import { useToggleWorkoutForDate, useToggleWorkoutToday } from '@/features/streak/hooks'
import { track } from '@/lib/analytics'
import {
  type CalendarDay,
  CoachLine,
  DayCheckIn,
  DayDetailPanel,
  type DayState,
  type DayStatus,
  LunarConstellation,
  SectionHeader,
  SkyBackground,
  StatSlider,
  StreakLine,
  TabHeader,
  TodayMealLog,
  TodayUniverseRewards,
  useCalendarDays,
  WeekStrip,
} from '@/features/tabs/components'
import { buildMonthGrid } from '@/features/tabs/components/constellation/data/month-grid'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import type { ZodiacSign } from '@/features/tabs/zodiac/types'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

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
  // The `slide` query param tells StatSlider which slide to land on.
  // Set by the Órbita focus CTA (DaySegment) so tapping "Marca tu
  // energía" lands the user directly on the wellbeing card instead
  // of at the top of Hoy.
  const { slide: slideParam } = useLocalSearchParams<{ slide?: string }>()

  const toggleToday = useToggleWorkoutToday()
  const toggleForDate = useToggleWorkoutForDate()

  const restQuery = useRestToday(ctx.date)
  const setRest = useSetRestToday(ctx.date)
  const setRestForDate = useSetRestForDate()
  const restedToday = restQuery.data ?? false

  const reducedMotion = useReducedMotion()
  const [celebrateKey, setCelebrateKey] = useState(0)
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

  // Defer the fullscreen CelebrateShockwave Skia Canvas off the first-paint
  // + entering-stagger critical path (Hoy ya monta varias superficies Skia +
  // dos SVG animados; sumar una 4ª pesa en la primera impresión). Se calienta
  // en idle ~1.2 s después (su layout + Canvas pasan UNA vez, igual que antes,
  // solo más tarde) — para entonces ya está listo antes de cualquier commit
  // realista. Si la usuaria marca "Entrené" antes (celebrateKey > 0), se monta
  // al instante, así el wash nunca llega tarde.
  const [shockwaveReady, setShockwaveReady] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setShockwaveReady(true), 1200)
    return () => clearTimeout(id)
  }, [])

  // Calendario "editor oficial": día seleccionado (abre el panel de detalle)
  // + overrides locales optimistas por fecha (status que se aplica al instante
  // mientras la mutación viaja; convergen al refetch, se limpian en onError).
  const [selectedDate, setSelectedDate] = useState<string>(ctx.date)
  const [dayOverrides, setDayOverrides] = useState<Record<string, DayStatus>>({})

  // Pause the constellation's animation loops while the page is actively
  // scrolling so the UI thread isn't split between scroll frames and the
  // SVG/Skia repaint — kills the scroll jank. A debounced idle timer flips it
  // back on ~140 ms after the last scroll event (covers drag + momentum), so
  // the figure freezes for the drag and resumes on release (imperceptible).
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleScroll = useCallback(() => {
    setIsScrolling((s) => (s ? s : true))
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => setIsScrolling(false), 140)
  }, [])

  // Tap del toast de delta → además de abrir el detalle del atributo
  // (lo hace TodayUniverseRewards), llevamos el scroll a "Tu universo
  // hoy" para que el panel quede a la vista al aterrizar desde otra tab.
  // El offset de la sección se captura por onLayout en su wrapper.
  const scrollRef = useRef<ScrollView>(null)
  const universeY = useRef(0)
  useEffect(() => {
    return subscribeUniverseDetailRequest(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, universeY.current - 80), animated: true })
    })
  }, [])
  // Same pause, but driven by the macros slider's HORIZONTAL drag — the
  // vertical-scroll handler above never fires for a sideways swipe, so the
  // cosmos kept animating and competed with the swipe (felt slow). Hold the
  // pause for the whole drag; release ~140 ms after it settles.
  const handleSlideSwipe = useCallback((active: boolean) => {
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    if (active) {
      setIsScrolling((s) => (s ? s : true))
    } else {
      scrollIdle.current = setTimeout(() => setIsScrolling(false), 140)
    }
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
  const month = useMemo(() => {
    const m = buildMonthGrid(todayIsoLocal, monthWorkoutDates)
    if (ctx.today_workout_completed && m.todayIdx >= 0 && !m.grid[m.todayIdx]) {
      m.grid[m.todayIdx] = true
      m.cells[m.todayIdx]!.trained = true
      m.trainedThisMonth += 1
    }
    return m
  }, [todayIsoLocal, monthWorkoutDates, ctx.today_workout_completed])

  // El calendario "editor oficial": fusiona workouts + daily_signals (descanso
  // + qué registró) + revelations (eventos). Reusa stripWorkouts internamente.
  const { days: calendarDays } = useCalendarDays({
    span: 30,
    today: todayIsoLocal,
    todayWorkoutCompleted: ctx.today_workout_completed,
    overrides: dayOverrides,
  })
  const selectedDay: CalendarDay | null = useMemo(
    () => calendarDays.find((d) => d.date === selectedDate) ?? null,
    [calendarDays, selectedDate],
  )

  const trainedThisMonth = month.trainedThisMonth
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
  const monthLabel = MONTHS_ES[Number(todayIsoLocal.slice(5, 7)) - 1] ?? 'Tu mes'

  const sign = useMemo(() => zodiacFromDate(profile?.date_of_birth), [profile?.date_of_birth])
  const signLabel = ZODIAC[sign].label

  // Orquestador de Revelaciones — única fuente de momentos full-screen en Hoy
  // (Regreso > Transformación > Patrón). Reemplaza al usePatternDetection
  // suelto: ahora T2/T3 + el nuevo T1 viven en un solo sistema.
  const { revelation, dismiss: dismissRevelation } = useRevelationOrchestrator(signLabel)
  // El % actual del emblema — la Revelación de Regreso lo muestra "donde lo
  // dejaste" (cacheado por useTransformProgress; misma fuente que el hero).
  const { progress: emblemProgress } = useTransformProgress()
  const figureCount = ZODIAC[sign].stars.length + ZODIAC[sign].lines.length

  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const greetingName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  const dayState: DayState = ctx.today_workout_completed
    ? 'trained'
    : restedToday
      ? 'rested'
      : 'undecided'

  const handleDayChange = (next: DayState) => {
    if (next === 'trained') {
      const wasFirstDay = isFirstDay
      if (restedToday) setRest.mutate(false)
      toggleToday.mutate(true)
      playCommitHaptic('trained')
      // Only gate on the reward when it actually plays (reduced motion shows
      // no Lottie → onAnimationFinish would never fire → stuck paused).
      if (!reducedMotion) setCelebrating(true)
      setCelebrateKey((k) => k + 1)
      if (wasFirstDay) {
        qc.invalidateQueries({ queryKey: queryKeys.profile.all })
      }
    } else if (next === 'rested') {
      if (ctx.today_workout_completed) toggleToday.mutate(false)
      setRest.mutate(true)
      playCommitHaptic('rested')
    } else {
      // Cleared back to undecided — undo whichever was set.
      if (ctx.today_workout_completed) toggleToday.mutate(false)
      if (restedToday) setRest.mutate(false)
    }
  }

  // Acciones del calendario sobre un día seleccionado. NUNCA celebran
  // (sin fireworks/shockwave/reward) — solo haptic suave + override optimista
  // para que el strip cambie al instante mientras la mutación viaja.
  const setOverride = useCallback((date: string, status: DayStatus) => {
    setDayOverrides((prev) => ({ ...prev, [date]: status }))
  }, [])
  const clearOverride = useCallback((date: string) => {
    setDayOverrides((prev) => {
      if (!(date in prev)) return prev
      const next = { ...prev }
      delete next[date]
      return next
    })
  }, [])

  const handleSelectDay = useCallback(
    (date: string) => {
      setSelectedDate(date)
      const d = calendarDays.find((c) => c.date === date)
      track('calendar_day_selected', {
        date,
        status: d?.status ?? 'empty',
        has_event: (d?.events.length ?? 0) > 0,
      })
    },
    [calendarDays],
  )

  const isToday = useCallback((date: string) => date === todayIsoLocal, [todayIsoLocal])

  const markTrained = useCallback(
    (date: string) => {
      setOverride(date, 'trained')
      // Si ese día estaba marcado como descanso, lo retiramos (mutuamente
      // excluyentes: la constelación se llena solo con entreno).
      setRestForDate.mutate({ date, rested: false }, { onError: () => clearOverride(date) })
      if (isToday(date)) {
        toggleToday.mutate(true, { onError: () => clearOverride(date) })
      } else {
        toggleForDate.mutate({ date, complete: true }, { onError: () => clearOverride(date) })
      }
      playCommitHaptic('backfill')
      track('calendar_day_marked', { date, status: 'trained', source: 'calendar' })
    },
    [setOverride, clearOverride, setRestForDate, isToday, toggleToday, toggleForDate],
  )

  const clearTrained = useCallback(
    (date: string) => {
      setOverride(date, 'empty')
      if (isToday(date)) {
        toggleToday.mutate(false, { onError: () => clearOverride(date) })
      } else {
        toggleForDate.mutate({ date, complete: false }, { onError: () => clearOverride(date) })
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      track('calendar_day_cleared', { date, was: 'trained' })
    },
    [setOverride, clearOverride, isToday, toggleToday, toggleForDate],
  )

  const markRested = useCallback(
    (date: string) => {
      setOverride(date, 'rested')
      // Descanso no llena estrella; si estaba entrenado lo quitamos.
      if (isToday(date)) {
        if (ctx.today_workout_completed) toggleToday.mutate(false)
        setRest.mutate(true, { onError: () => clearOverride(date) })
      } else {
        toggleForDate.mutate({ date, complete: false })
        setRestForDate.mutate({ date, rested: true }, { onError: () => clearOverride(date) })
      }
      playCommitHaptic('rested')
      track('calendar_day_marked', { date, status: 'rested', source: 'calendar' })
    },
    [
      setOverride,
      clearOverride,
      isToday,
      ctx.today_workout_completed,
      toggleToday,
      toggleForDate,
      setRest,
      setRestForDate,
    ],
  )

  const clearRested = useCallback(
    (date: string) => {
      setOverride(date, 'empty')
      if (isToday(date)) {
        setRest.mutate(false, { onError: () => clearOverride(date) })
      } else {
        setRestForDate.mutate({ date, rested: false }, { onError: () => clearOverride(date) })
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      track('calendar_day_cleared', { date, was: 'rested' })
    },
    [setOverride, clearOverride, isToday, setRest, setRestForDate],
  )

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
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Animated.View entering={enter(40)}>
              <TabHeader greeting={`Hola, ${greetingName}.`} greetingEmphasis={greetingName} />
            </Animated.View>

            {/* El momento de Regreso (3+ días fuera) ahora es la Revelación
                de Regreso full-screen del orquestador (T2) — el ReturnMoment
                inline se retiró para no duplicar el momento (spec Decisión #3). */}

            <Animated.View entering={enter(120)}>
              <DayCheckIn state={dayState} onChange={handleDayChange} />
            </Animated.View>

            <Animated.View entering={enter(160)}>
              <StreakLine streak={ctx.streak_days} />
            </Animated.View>

            <Animated.View entering={enter(220)} style={styles.constellationHeader}>
              <Text style={styles.constellationHeaderText}>Tu {signLabel}</Text>
              {/* La regla principal como DESCRIPCIÓN del mecanismo (no
                  prescripción): referencia el marcador «Entrené» que la
                  usuaria ya toca, en vez de "cuando entrenas" (imperativo
                  encubierto). La constelación responde SOLO a ese marcador;
                  comida/agua/sueño alimentan el universo, no las estrellas. */}
              <Text style={styles.constellationRule}>Cada «Entrené» enciende una estrella.</Text>
            </Animated.View>

            <Animated.View entering={enter(320)} style={styles.constellationWrap}>
              <LunarConstellation
                trained={month.grid}
                todayIdx={month.todayIdx}
                target={month.daysInMonth}
                sign={sign}
                committed={ctx.today_workout_completed}
                suppressBurst
                pausedSV={constellationPaused}
              />

              {!reducedMotion && celebrateKey > 0 ? (
                <View pointerEvents="none" style={styles.celebration}>
                  <LottieView
                    key={celebrateKey}
                    source={require('../../assets/lottie/gold-fireworks.json')}
                    autoPlay
                    loop={false}
                    speed={0.6}
                    resizeMode="contain"
                    style={styles.celebrationLottie}
                    onAnimationFinish={() => setCelebrating(false)}
                  />
                </View>
              ) : null}
            </Animated.View>

            <Animated.View entering={enter(420)} style={styles.coachLineWrap}>
              <CoachLine
                align="center"
                {...getCoachCopy(trainedThisMonth, signLabel, dayState === 'trained', sign)}
              />
              {(() => {
                if (dayState !== 'trained') return null
                if (trainedThisMonth >= figureCount) {
                  return (
                    <Text style={styles.tomorrowHint}>
                      Mañana sumas <Text style={styles.tomorrowHintEmphasis}>luz extra</Text>.
                    </Text>
                  )
                }
                // Last star before the asterism is whole.
                if (trainedThisMonth + 1 >= figureCount) {
                  return (
                    <Text style={styles.tomorrowHint}>
                      Mañana <Text style={styles.tomorrowHintEmphasis}>completas tu figura</Text>.
                    </Text>
                  )
                }
                const next = pickStarForCount(sign, trainedThisMonth + 1)
                if (!next) return null
                return (
                  <Text style={styles.tomorrowHint}>
                    Mañana: <Text style={styles.tomorrowHintEmphasis}>{next.name}</Text>,{' '}
                    {next.role}
                  </Text>
                )
              })()}
            </Animated.View>

            {/* ── Nivel 2 · Consecuencia (lectura, no acción) ──────────────
                "Tu transformación" + "Tu universo hoy": lo que el esfuerzo
                reveló. No mutan datos ni navegan de sorpresa. */}

            {/* "Tu transformación" (compacta) — cuánto se reveló el emblema y
                en qué etapa va; el detalle del mes vive tras un link explícito.
                Solo Leo con primer hábito (la tarjeta se gatea sola). */}
            <Animated.View entering={enter(450)}>
              <TransformationCard compact />
            </Animated.View>

            {/* "Tu universo hoy" — capa de recompensa para los registros
                que NO encienden estrellas (comida/agua/sueño/check-in).
                Autónoma: sus re-renders no tocan la constelación. */}
            <Animated.View
              entering={enter(470)}
              onLayout={(e) => {
                universeY.current = e.nativeEvent.layout.y
              }}
            >
              <TodayUniverseRewards ctx={ctx} date={ctx.date} restedToday={restedToday} />
            </Animated.View>

            {/* ── Nivel 3 · Contexto del día e historia ────────────────────
                Lo que la usuaria consulta cuando ya hizo lo principal:
                macros, comidas, y el calendario (historia/editor) al final. */}

            <Animated.View entering={enter(520)}>
              <StatSlider
                ctx={ctx}
                targetSlide={slideParam ?? null}
                onSwipeStateChange={handleSlideSwipe}
              />
            </Animated.View>

            <Animated.View entering={enter(560)}>
              <SectionHeader label="Comidas de hoy" />
            </Animated.View>
            <Animated.View entering={enter(600)}>
              <TodayMealLog
                date={ctx.date}
                onOpenMeal={(id) => router.push({ pathname: '/scan-meal', params: { editId: id } })}
                onAddMeal={() => router.push({ pathname: '/capture-meal' })}
              />
            </Animated.View>

            {/* Calendario — el editor oficial de la constelación + puente a
                Historia. Va al FINAL: es contexto/historia ("así va tu mes"),
                no la acción del día (esa es el toggle de arriba). Tocar un día
                lo selecciona y abre su detalle; el día de HOY solo se lee
                (se marca arriba), los pasados se pueden editar sin celebración. */}
            <Animated.View entering={enter(680)}>
              <SectionHeader label={monthLabel} />
              <Text style={styles.weekHint}>
                Tu mes hasta hoy · toca un día para ver el detalle.
              </Text>
              <WeekStrip
                days={calendarDays}
                selectedDate={selectedDate}
                onSelect={handleSelectDay}
              />
              {selectedDay ? (
                <DayDetailPanel
                  day={selectedDay}
                  onMarkTrained={markTrained}
                  onMarkRested={markRested}
                  onClearTrained={clearTrained}
                  onClearRested={clearRested}
                />
              ) : null}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
        {/* Montaje DIFERIDO (no en el primer paint): el Canvas Skia + su
          layout pasan UNA vez, pero ~1.2 s después (en idle) en vez de
          competir con la primera impresión + el stagger de entrada. Para
          entonces ya está caliente antes de cualquier commit; y si la
          usuaria marca "Entrené" antes (celebrateKey > 0) se monta al
          instante, así el wash nunca llega tarde. Invisible hasta que
          `celebrateKey` sube y la timeline anima u → 1. */}
        {!reducedMotion && (shockwaveReady || celebrateKey > 0) ? (
          <CelebrateShockwave celebrateKey={celebrateKey} />
        ) : null}
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
      { before: 'Tu órbita ya tiene ', emphasis: 'forma', after: '.' },
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
    return { before: 'Diez. Ya no es casualidad, es ', emphasis: 'tuyo', after: '.' }
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
    paddingTop: 12,
    paddingBottom: 36,
  },
  weekHint: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginTop: -4,
    marginBottom: 4,
  },
  constellationHeader: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  constellationWrap: {
    marginHorizontal: -20,
  },
  celebration: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationLottie: {
    width: '100%',
    height: '100%',
  },
  constellationHeaderText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 26,
    color: colors.leche,
    letterSpacing: 1.0,
  },
  // La regla de la constelación — UI quieta (niebla), bajo el título.
  constellationRule: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    marginTop: 3,
    textAlign: 'center',
  },
  coachLineWrap: {
    marginTop: 6,
    marginBottom: 14,
  },
  tomorrowHint: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  tomorrowHintEmphasis: {
    color: colors.bone,
  },
})
