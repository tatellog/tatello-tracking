import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import {
  DayPresent,
  MonthSegment,
  MonthSegmentIA,
  OrbitSegments,
  ScreenCosmos,
  WeekSegment,
  type OrbitSegment,
} from '@/features/orbit/components'
import { useSession } from '@/hooks/useSession'
import { aiEnabledForEmail, ORBITA_SINGLE_FEED } from '@/lib/featureFlags'
import { useOrbitDayRollover } from '@/features/orbit/hooks'
import { usePatternMemoryWriter } from '@/features/orbit/pattern-memory'
import { consumeOrbitSegment } from '@/features/orbit/pending-segment'
import { ScrollPauseContext } from '@/features/orbit/useScreenActive'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingView } from '@/components/LoadingView'
import { SkyBackground, TabHeader } from '@/features/tabs/components'
import { track } from '@/lib/analytics'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

/*
 * Tu Órbita — STELAR's core tab, the meaning layer. Three time
 * altitudes of one sky: Día (El Sistema) · Semana (Las Órbitas) ·
 * Mes (El Cielo). See docs/tu-orbita-design.md.
 *
 * Día renders the live orbital diagram. The engine-fed pieces (Voz de
 * Stelar, patrones) currently run on MOCK data — see features/orbit/
 * mock.ts — until the Anthropic key is in.
 */
export default function OrbitScreen() {
  return (
    <ErrorBoundary screen="orbita">
      <OrbitBody />
    </ErrorBoundary>
  )
}

function OrbitBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'orbita' })
    }, []),
  )
  // Órbita Mes IA gateado POR USUARIO: solo la cuenta dev vive el rediseño;
  // la beta ve el Mes de 4 tiempos de siempre.
  const { session } = useSession()
  const mesIAEnabled = aiEnabledForEmail(session?.user?.email)
  // Al cruzar la medianoche con el tab montado, recalcula "hoy" → fetch limpio
  // (si no, Órbita seguiría mostrando los datos de ayer como hoy).
  useOrbitDayRollover()
  // Memoria de patrones: archiva los patrones que potencian (rescate, señal
  // naciente) en Historia antes de que se evaporen de la ventana. Corre para
  // TODAS las usuarias (beta ve MonthSegment; el writer es self-contained, no
  // depende del segmento). Idempotente por el reposo de 14 días.
  usePatternMemoryWriter()
  const [segment, setSegment] = useState<OrbitSegment>('dia')
  // Día visto en Órbita Día: null = hoy. Lo setea la tira de 7 días de Semana;
  // cambiar de segmento a mano (OrbitSegments) lo resetea a hoy.
  const [viewedDay, setViewedDay] = useState<string | null>(null)
  // 9.1 · memoria del segmento de ORIGEN al abrir un día pasado: el back del
  // summary→detail nunca se rompe (Apple) — desde el calendario de Mes,
  // "Volver" regresa a Mes, no te deja varada en Día-hoy.
  const [dayOrigin, setDayOrigin] = useState<Exclude<OrbitSegment, 'dia'> | null>(null)

  // Órbita de un solo scroll: 'feed' (anillos + patrones + mes) o el detalle
  // de hoy / del mes, abierto desde el feed con su "‹ Volver".
  const [feedView, setFeedView] = useState<'feed' | 'day' | 'month'>('feed')
  // Un día abierto desde el chat del patrón vuelve a la conversación, no al feed.
  const [dayFromChat, setDayFromChat] = useState(false)
  const [resumeChat, setResumeChat] = useState(false)

  useFocusEffect(
    useCallback(() => {
      const pending = consumeOrbitSegment()
      if (!pending) return
      if (ORBITA_SINGLE_FEED) {
        // Los enlaces viejos a un segmento aterrizan en el feed (patrones),
        // salvo 'dia', que abre el detalle de hoy.
        setFeedView(pending === 'dia' ? 'day' : 'feed')
        return
      }
      setSegment(pending)
    }, []),
  )

  useEffect(() => {
    track('orbit_viewed', { segment: ORBITA_SINGLE_FEED ? feedView : segment })
  }, [segment, feedView])

  // Pause every screen-active-gated loop (OrbitalSystem, ScreenCosmos, …) while
  // the page is actively scrolling — the orbit diagram is the heaviest tab, so
  // splitting the UI thread between scroll frames and its SVG/Skia repaint is
  // the jank. Debounced idle flips it back ~140 ms after the last scroll event.
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])
  const handleScroll = useCallback(() => {
    setIsScrolling((s) => (s ? s : true))
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => setIsScrolling(false), 140)
  }, [])

  // Deferred mount — Órbita is the heaviest tab (ScreenCosmos Skia nebula +
  // the orbital diagram's Skia canvases + big SVG). On the FIRST tap its slow
  // first paint left the screen black. Paint the LIGHT chrome first (dark sky +
  // the skeleton) so the tab shows something immediately, then mount the heavy
  // content one frame later (it fades in over the skeleton). freezeOnBlur is
  // off, so OrbitBody stays mounted after the first visit → no re-flash on
  // return; the skeleton only ever shows once.
  const [heavyMounted, setHeavyMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setHeavyMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (!heavyMounted) {
    return (
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </View>
    )
  }

  return (
    <ScrollPauseContext.Provider value={isScrolling}>
      <View style={styles.screen}>
        <SkyBackground />
        <ScreenCosmos width={SCREEN_W} height={SCREEN_H} />

        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="orbit-ambient" cx="50%" cy="48%" rx="75%" ry="70%">
              <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.1} />
              <Stop offset="55%" stopColor={colors.magenta} stopOpacity={0.035} />
              <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#orbit-ambient)" />
        </Svg>

        <SafeAreaView style={styles.flex} edges={['top']}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Animated.View entering={FadeIn.duration(280)}>
              <TabHeader title="Tu Órbita" titleEmphasis="Tu" />
            </Animated.View>

            {ORBITA_SINGLE_FEED ? (
              <OrbitFeed
                view={feedView}
                viewedDay={viewedDay}
                onOpenDay={() => {
                  setViewedDay(null)
                  setFeedView('day')
                  scrollToTop()
                }}
                onOpenMonth={() => {
                  setFeedView('month')
                  scrollToTop()
                }}
                onBack={() => {
                  setViewedDay(null)
                  setDayFromChat(false)
                  setFeedView('feed')
                  scrollToTop()
                }}
                onPickDay={(date) => {
                  setViewedDay(date)
                  setDayFromChat(false)
                  setFeedView('day')
                  scrollToTop()
                }}
                dayFromChat={dayFromChat}
                onPickDayFromChat={(date) => {
                  setViewedDay(date)
                  setDayFromChat(true)
                  setFeedView('day')
                  scrollToTop()
                }}
                onBackToChat={() => {
                  setViewedDay(null)
                  setDayFromChat(false)
                  setFeedView('feed')
                  setResumeChat(true)
                }}
                resumeChat={resumeChat}
                onChatResumed={() => setResumeChat(false)}
              />
            ) : (
              <>
                <Animated.View entering={FadeIn.duration(320).delay(80)}>
                  <OrbitSegments
                    value={segment}
                    onChange={(seg) => {
                      setViewedDay(null) // navegar a mano vuelve a hoy
                      setDayOrigin(null)
                      setSegment(seg)
                    }}
                  />
                </Animated.View>

                {/* Only the active segment is mounted — so only ONE constellation's
              Reanimated loops + Skia canvas exist at a time. (Keeping all three
              mounted + frozen does NOT pause Reanimated loops — react-freeze
              only suspends React renders, the withRepeat timers keep running on
              the UI thread — so it would TRIPLE the animation load. Conditional
              mount is the cheaper baseline.) The `key` replays the fade-in.
              Semana hands the segment switch back for its "Abrir Día" CTA. */}
                {segment === 'dia' ? (
                  <DayPresent
                    key="dia"
                    viewedDay={viewedDay}
                    returnLabel={
                      dayOrigin === 'mes'
                        ? 'Volver a tu mes'
                        : dayOrigin === 'semana'
                          ? 'Volver a tu semana'
                          : undefined
                    }
                    onReturnToToday={() => {
                      setViewedDay(null)
                      if (dayOrigin) {
                        setSegment(dayOrigin)
                        setDayOrigin(null)
                        scrollToTop()
                      }
                    }}
                    onOpenWeek={() => {
                      setSegment('semana')
                      scrollToTop()
                    }}
                  />
                ) : segment === 'semana' ? (
                  <WeekSegment
                    key="semana"
                    onOpenMes={() => setSegment('mes')}
                    onPickDay={(date) => {
                      setViewedDay(date)
                      setDayOrigin('semana')
                      setSegment('dia')
                    }}
                    onScrollTop={scrollToTop}
                  />
                ) : mesIAEnabled ? (
                  <MonthSegmentIA
                    key="mes-ia"
                    onPickDay={(date) => {
                      setViewedDay(date)
                      setDayOrigin('mes')
                      setSegment('dia')
                    }}
                  />
                ) : (
                  <MonthSegment
                    key="mes"
                    onPickDay={(date) => {
                      setViewedDay(date)
                      setDayOrigin('mes')
                      setSegment('dia')
                    }}
                    onScrollTop={scrollToTop}
                  />
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </ScrollPauseContext.Provider>
  )
}

/*
 * La Órbita de un solo scroll (ORBITA_SINGLE_FEED · fase A). Responde lo que
 * la usuaria viene a buscar: "qué encontró Stelar de mí". Arriba, hoy en
 * compacto (los anillos que le gustan + "¿sigo en déficit?"); al centro, Tus
 * patrones (el motor del Mes, sin tocar backend); al pie, el mes completo.
 * El detalle de hoy y el del mes se abren desde aquí, con "‹ Volver".
 */
function OrbitFeed({
  view,
  viewedDay,
  onOpenDay,
  onOpenMonth,
  onBack,
  onPickDay,
  dayFromChat,
  onPickDayFromChat,
  onBackToChat,
  resumeChat,
  onChatResumed,
}: {
  view: 'feed' | 'day' | 'month'
  viewedDay: string | null
  onOpenDay: () => void
  onOpenMonth: () => void
  onBack: () => void
  onPickDay: (date: string) => void
  dayFromChat: boolean
  onPickDayFromChat: (date: string) => void
  onBackToChat: () => void
  resumeChat: boolean
  onChatResumed: () => void
}) {
  if (view === 'day') {
    // Un día pasado trae su propio "‹ Volver…" (DayPresent); hoy no, así que
    // aquí va el nuestro (a la conversación si el día se abrió desde el chat).
    const pastDay = viewedDay != null && viewedDay !== todayInTimezone()
    return (
      <View>
        {pastDay ? null : dayFromChat ? (
          <BackLink onPress={onBackToChat} label="Volver a la conversación" />
        ) : (
          <BackLink onPress={onBack} />
        )}
        <DayPresent
          key="feed-day"
          viewedDay={viewedDay}
          onReturnToToday={dayFromChat ? onBackToChat : onBack}
          returnLabel={dayFromChat ? 'Volver a la conversación' : 'Volver a tu órbita'}
        />
      </View>
    )
  }
  if (view === 'month') {
    return (
      <View>
        <BackLink onPress={onBack} />
        <MonthSegment key="feed-month" view="month" onPickDay={onPickDay} />
      </View>
    )
  }
  return (
    <Animated.View entering={FadeIn.duration(320).delay(60)}>
      <Text style={styles.feedLede}>Lo que tus datos dicen de ti.</Text>
      <DayPresent key="feed-today" compact onOpenDay={onOpenDay} />
      <MonthSegment
        key="feed-patterns"
        view="patterns"
        onPickDayFromChat={onPickDayFromChat}
        resumeChat={resumeChat}
        onChatResumed={onChatResumed}
      />
      <Pressable
        onPress={onOpenMonth}
        hitSlop={8}
        style={styles.feedLink}
        accessibilityRole="button"
        accessibilityLabel="Tu mes de un vistazo"
      >
        <Text style={styles.feedLinkText}>Tu mes de un vistazo ›</Text>
      </Pressable>
    </Animated.View>
  )
}

function BackLink({
  onPress,
  label = 'Volver a tu órbita',
}: {
  onPress: () => void
  label?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.backLink}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.feedLinkText}>{`‹ ${label}`}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  feedLede: {
    marginTop: -6,
    marginBottom: 20,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  feedLink: {
    alignSelf: 'center',
    marginTop: 32,
    paddingVertical: 10,
  },
  feedLinkText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.3,
    color: colors.niebla,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 4,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
})
