import { curveMonotoneX, line as d3Line } from 'd3-shape'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BriefContext } from '@/features/brief/api'
import {
  CycleNextMilestone,
  CyclePhaseHero,
  CycleTimeline,
  nextMilestoneLine,
} from '@/features/cycle/components/CycleTimeline'
import { PHASE_LABEL, type CyclePhase } from '@/features/cycle/phase'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { DailyNoteInline } from '@/features/moods/components/DailyNoteInline'
import { MoodSliderInline } from '@/features/moods/components/MoodSliderInline'
import { computeTdee, enfoqueLabel, reconstructState } from '@/features/profile/calcMacros'
import { useMacroInputs } from '@/features/profile/hooks'
import { useMeasurements } from '@/features/progress/hooks'
import { toWeightPoints, type WeightPoint } from '@/features/progress/logic'
import type { SleepDraft } from '@/features/sleep/api'
import { useSleepLog, useUpsertSleep } from '@/features/sleep/hooks'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import { RingCard } from './RingCard'

// Macros lead — the day's most-checked number — then the morning
// rituals (sleep, check-in), the cycle phase (read-only, reframes
// the rest), and the slow weight trend. Water lives in the QuickLog
// (✦); registering it here too would duplicate that.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// How much of the NEXT slide peeks on the right edge — a persistent "hay más"
// affordance. Slides are this much narrower than the viewport.
const SLIDE_PEEK = 22

type Props = {
  ctx: BriefContext
  /** Slide id to auto-scroll to when set (e.g. 'sleep', 'wellbeing',
   *  'macros'). Set by query param when the user lands on Hoy from the
   *  Órbita focus CTA — the slider jumps to the relevant card instead
   *  of staying on macros and forcing them to swipe. `null` = no
   *  override; the user's current position stays. */
  targetSlide?: string | null
  /** Called true while the user is actively dragging the carousel, false when
   *  it settles. Hoy uses it to PAUSE the heavy background animations (the
   *  constellation + the SkyBackground starfield) during a horizontal swipe —
   *  the vertical-scroll pause doesn't fire for a sideways drag, so without
   *  this the swipe competed with all the cosmos animation and felt slow. */
  onSwipeStateChange?: (active: boolean) => void
}

/**
 * The Hoy-tab stat slider — a paged carousel whose section title
 * changes per slide: today's macros, last night's sleep, the morning
 * check-in, the weight trend. Sleep and the check-in register inline
 * (once-a-day morning rituals, not QuickLog actions); macros and
 * weight are read-only views. Pagination dots track the position;
 * the title cross-fades as the slider pages.
 */
export function StatSlider({ ctx, targetSlide, onSwipeStateChange }: Props) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(0)
  // Un slide con arrastre horizontal propio (el slider de ánimo) bloquea el
  // pager mientras dura su gesto, si no ambos compiten por el swipe horizontal.
  const [pagerEnabled, setPagerEnabled] = useState(true)

  // Gesto NATIVO del scroll del pager. El slider de ánimo hace
  // `blocksExternalGesture(pagerNative)` → cuando su Pan se activa (arrastre
  // horizontal), bloquea el scroll del carrusel de forma NATIVA (sin el race del
  // toggle scrollEnabled, que dejaba que el swipe robara el arrastre del mood).
  const pagerNative = useMemo(() => Gesture.Native(), [])

  // Slide width = viewport minus the peek, so the next slide shows on the
  // right. This is also the snap pitch (replaces page-width paging).
  const slideW = width > 0 ? width - SLIDE_PEEK : width

  // Imperative ScrollView ref for the auto-peek demo (see effect
  // below) — Animated.ScrollView exposes a real `scrollTo` via ref.
  const scrollRef = useRef<Animated.ScrollView>(null)

  // True once the user has paged at least once — the swipe hint then hides
  // permanently for the session (acceptance: "el primer swipe oculta el hint").
  const hasSwipedRef = useRef(false)

  // Tracks the last `targetSlide` we honoured, so the deep-link
  // scroll fires ONCE per param change and never re-snaps when the
  // user manually pages away. Without this guard, every re-render
  // would re-scroll the user back to the deep-linked slide.
  const honouredTargetRef = useRef<string | null>(null)

  // Live scroll offset — drives the per-slide enter/leave animation.
  const scrollX = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  // LIVE page index — flips the moment the drag crosses a page midpoint,
  // not when the momentum dies. The old flow updated `active` only in
  // onMomentumScrollEnd, so the title + dots lagged ~half a second behind
  // the finger — that lag is what read as "the slider is slow". A
  // selection haptic on each flip gives the page-turn a physical click.
  const livePageChange = (idx: number) => {
    if (idx < 0) return
    Haptics.selectionAsync().catch(() => {})
    // First swipe hides the "Desliza para ver más" hint permanently (session).
    if (idx > 0 && !hasSwipedRef.current) hasSwipedRef.current = true
    track('stat_slider_swiped', { slide: idx })
    setActive(idx)
  }
  useAnimatedReaction(
    () => (slideW > 0 ? Math.round(scrollX.value / slideW) : 0),
    (idx, prev) => {
      if (prev === null || idx === prev) return
      runOnJS(livePageChange)(idx)
    },
    [slideW],
  )

  // (The old one-shot auto-peek demo was removed: the next slide now peeks
  // permanently on the right edge, so the "esto se desliza" cue is always
  // there — no scripted scroll needed.)

  // Real cycle phase (null when the user has no active/anchored cycle).
  const cycle = useCyclePhase()

  // Slides are built dynamically so the cycle slide ONLY appears when
  // there's a real cycle to show — never a fake/mock one for users who
  // don't menstruate or haven't anchored a period (matches Progreso's
  // gating).
  // Stable ids (not titles) for keys, and the cycle slide LAST so it
  // appearing/disappearing never shifts the indices of slides the user
  // may already be paged to (keeps scrollX / active in sync).
  const slides: { id: string; title: string; node: ReactNode }[] = [
    { id: 'macros', title: 'Macros de hoy', node: <MacroSlide ctx={ctx} /> },
    { id: 'sleep', title: 'Sueño de anoche', node: <SleepSlide date={ctx.date} /> },
    {
      id: 'wellbeing',
      title: 'Cómo amaneciste',
      node: (
        <WellbeingSlide
          date={ctx.date}
          onLockPager={(locked) => setPagerEnabled(!locked)}
          pagerGesture={pagerNative}
          // wellbeing es SIEMPRE el índice 2 (macros·sleep·wellbeing van fijos al
          // frente). Con scrollX+índice+ancho el mood decide solo si está centrada:
          // así su track no roba el swipe cuando solo asoma en el peek de otra slide.
          scrollX={scrollX}
          slideIndex={2}
          slideW={slideW}
        />
      ),
    },
    ...(cycle ? [{ id: 'cycle', title: 'Tu ciclo', node: <CycleSlide cycle={cycle} /> }] : []),
    // Peso al final: es la tendencia lenta, no un ritual diario → cierra el pager.
    { id: 'weight', title: 'Tu peso', node: <WeightSlide ctx={ctx} /> },
  ]
  const safeActive = Math.min(active, slides.length - 1)

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== width) setWidth(w)
  }

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onSwipeStateChange?.(false)
    if (slideW === 0) return
    const idx = Math.round(e.nativeEvent.contentOffset.x / slideW)
    if (idx !== active && idx >= 0 && idx < slides.length) setActive(idx)
  }

  // DEEP-LINK SCROLL — when `targetSlide` arrives (set by the Órbita
  // focus CTA via query param), jump the carousel to the matching
  // slide. Fires ONCE per distinct `targetSlide` value via
  // honouredTargetRef; subsequent renders (with the param still
  // sticky on the route) don't re-snap the user.
  //
  // `animated: false` — the user must land EXACTLY on the target
  // slide as a deep-link, not see an auto-tour scroll-by. The tab
  // switch animation is already playing; layering an animated scroll
  // on top reads as the screen jittering. Instant snap = the slider
  // is "just there" when the tab paints, the same way a hash anchor
  // works on the web.
  //
  useEffect(() => {
    // Al limpiarse el param (Hoy lo borra tras honrar el deep-link), reseteamos
    // el guard para que volver a pedir el MISMO slide vuelva a enfocar.
    if (!targetSlide || slideW === 0) {
      if (!targetSlide) honouredTargetRef.current = null
      return
    }
    if (honouredTargetRef.current === targetSlide) return
    const idx = slides.findIndex((s) => s.id === targetSlide)
    if (idx < 0) return
    honouredTargetRef.current = targetSlide
    scrollRef.current?.scrollTo({ x: idx * slideW, animated: false })
    setActive(idx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSlide, slideW])

  return (
    <View onLayout={onLayout}>
      <View style={styles.header}>
        {/* Re-keyed on `active` so the title cross-fades when paging. */}
        <Animated.View key={safeActive} entering={FadeIn.duration(280)}>
          <EyebrowLabel tone="magenta">{slides[safeActive]?.title ?? ''}</EyebrowLabel>
        </Animated.View>
        {/* Strategy chip — only on the macros slide. Ties today's numbers
            to the chosen enfoque ("Déficit moderado") as quiet context,
            not a metric. Tapping it opens the goal editor. */}
        {safeActive === 0 && ctx.targets ? (
          <EnfoqueChip
            targetCalories={ctx.targets.calories}
            consumedCalories={ctx.today_macros.calories}
          />
        ) : null}
      </View>

      {width > 0 ? (
        <GestureDetector gesture={pagerNative}>
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            // Peek carousel: each slide is `slideW` wide (viewport − peek) so the
            // next slide shows on the right. That requires snapToInterval (NOT
            // pagingEnabled, which forces a full-viewport snap and would hide the
            // peek) on BOTH platforms. `decelerationRate: fast` keeps it snappy;
            // Android adds disableIntervalMomentum so it doesn't float past.
            scrollEnabled={pagerEnabled}
            snapToInterval={slideW}
            snapToAlignment="start"
            decelerationRate="fast"
            {...(Platform.OS === 'android' ? { disableIntervalMomentum: true } : {})}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            // Trailing pad so the LAST slide can settle flush (no orphan peek gap).
            contentContainerStyle={{ paddingRight: SLIDE_PEEK }}
            onScrollBeginDrag={() => onSwipeStateChange?.(true)}
            onScrollEndDrag={() => onSwipeStateChange?.(false)}
            onMomentumScrollEnd={onScrollEnd}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {slides.map((s, i) => (
              <Slide key={s.id} index={i} width={slideW} scrollX={scrollX}>
                {s.node}
              </Slide>
            ))}
          </Animated.ScrollView>
        </GestureDetector>
      ) : (
        <View style={styles.measurePlaceholder} />
      )}

      {/* Pagination + swipe affordance. `showHint=true` until the user
          has paged at least once (active > 0 at some point); after
          that the hint hides permanently for this session. The hint
          itself is a bouncing `›` to the right of the dots — discreet
          but clear that there's more content to the side. Each dot is
          tappable como atajo directo a su slide. */}
      <Dots
        count={slides.length}
        active={safeActive}
        showHint={active === 0 && !hasSwipedRef.current}
        onDotPress={(i) => {
          track('stat_slider_dot_pressed', { slide: i })
          scrollRef.current?.scrollTo({ x: i * slideW, animated: true })
        }}
      />
    </View>
  )
}

/* Each slide breathes as the carousel pages: a slide off-centre
 * fades and scales down a touch, the centred one sits full. The
 * effect is tied straight to the scroll offset, so it tracks the
 * finger left and right rather than only snapping at the end. */
function Slide({
  index,
  width,
  scrollX,
  children,
}: {
  index: number
  width: number
  scrollX: SharedValue<number>
  children: ReactNode
}) {
  const style = useAnimatedStyle(() => {
    const d = width > 0 ? scrollX.value / width - index : 0
    return {
      opacity: interpolate(d, [-1, 0, 1], [0.5, 1, 0.5], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [-1, 0, 1], [0.94, 1, 0.94], Extrapolation.CLAMP) }],
    }
  })
  return <Animated.View style={[{ width }, style]}>{children}</Animated.View>
}

/* Strategy chip in the macros header. For a deficit strategy it reads the
 * LIVE day standing: while today's intake stays under maintenance (TDEE)
 * the user is still losing, even past their calorie goal — "Aún en
 * déficit" reframes going over the target as not-failure (manifiesto:
 * context, no guilt). Once intake reaches maintenance it softens to a
 * neutral "En tu mantenimiento". Surplus / maintain keep the static
 * enfoque label. Quiet by design; renders nothing without a TDEE. */
function EnfoqueChip({
  targetCalories,
  consumedCalories,
}: {
  targetCalories: number
  consumedCalories: number
}) {
  const { inputs } = useMacroInputs()
  const state = reconstructState(targetCalories, inputs)
  if (!state) return null
  // `state` is non-null only when a TDEE exists, so this is always a number.
  const tdee = computeTdee(inputs)
  const label =
    state.enfoque === 'deficit' && tdee != null
      ? consumedCalories < tdee
        ? 'Aún en déficit'
        : 'En tu mantenimiento'
      : enfoqueLabel(state.enfoque, state.level)
  // Pure status, not a button: editing lives on the cards ("Ajustar ›"),
  // so the chip is only context and never surprises with a navigation.
  return (
    <View
      style={styles.enfoqueChip}
      accessibilityRole="text"
      accessibilityLabel={`Tu enfoque hoy: ${label}`}
    >
      <View style={styles.enfoqueDot} />
      <Text style={styles.enfoqueChipText}>{label}</Text>
    </View>
  )
}

/* ─── Slide 1 — today's macros ─────────────────────────────────────── */

function MacroSlide({ ctx }: { ctx: BriefContext }) {
  const router = useRouter()
  // Tocar una tarjeta abre el editor de METAS (reusa la pantalla validada que
  // ya usan Comidas/Ajustes). source=settings → vuelve atrás a Hoy al guardar.
  const editTargets = () => router.push('/onboarding/macro-targets?source=settings')
  if (!ctx.targets) {
    return (
      <View style={[styles.slide, styles.emptyCard]}>
        <Text style={styles.emptyText}>Configura tus metas para ver tus macros.</Text>
      </View>
    )
  }
  // Calories — a speedometer gauge that exceeds when consumed > target.
  // The big number is what you've eaten today. The subtitle mirrors the
  // protein card's compact "/ target unit" form ("380 / 1835 kcal") instead
  // of a wordy "de 1835 kcal · faltan 1455" sentence — that ran to 4 cramped
  // lines in the half-width card on Android. Dropping the "faltan" countdown
  // read is also more manifiesto-aligned (calories as context, not a budget
  // to spend down). Over-target stays a short, informational +N (the amber
  // overflow arc already carries the "you went over" without a verdict).
  const caloriesConsumed = ctx.today_macros.calories
  const caloriesTarget = ctx.targets.calories
  const calOver = Math.max(0, Math.round(caloriesConsumed - caloriesTarget))
  const calSubtitle = calOver > 0 ? `+${calOver} kcal` : `/ ${caloriesTarget} kcal`

  // Línea honesta "cuánto te falta/queda" (copy autorizado para macros).
  // Al cumplir, voz cálida — NO checklist ("✓ Meta cumplida" suena a app de
  // hábitos): proteína "cerrada" (vocabulario que ya usa el coach), calorías
  // "En tu meta". Si te pasaste, el +N del subtítulo ya lo dice solo (sin
  // "te pasaste", manifiesto).
  const proteinLeft = Math.max(0, Math.round(ctx.targets.protein_g - ctx.today_macros.protein_g))
  const proteinRemaining = proteinLeft > 0 ? `Te faltan ${proteinLeft} g` : 'Proteína cerrada'
  const calLeft = Math.max(0, Math.round(caloriesTarget - caloriesConsumed))
  const calRemaining = calOver > 0 ? null : calLeft > 0 ? `Te quedan ${calLeft} kcal` : 'En tu meta'
  return (
    <View style={[styles.slide, styles.macroRow]}>
      {/* Each card cascades in (FadeInDown staggered) on first paint
          and then breathes continuously with an out-of-phase 3.4 s
          drift so the row never feels statically pinned. The rings
          inside still draw via their own `ringDelay` timeline —
          these animations sit on the card wrapper, not the ring. */}
      <MacroCardWrap enterDelay={120}>
        <RingCard
          label="Proteína"
          value={ctx.today_macros.protein_g}
          target={ctx.targets.protein_g}
          formatted={Math.round(ctx.today_macros.protein_g).toString()}
          unitSuffix={`/ ${ctx.targets.protein_g} g`}
          remainingText={proteinRemaining}
          ringColor={colors.magenta}
          ringDelay={400}
          onPress={editTargets}
        />
      </MacroCardWrap>
      <MacroCardWrap enterDelay={280}>
        <RingCard
          speedometer
          label="Calorías"
          value={caloriesConsumed}
          target={caloriesTarget}
          formatted={Math.round(caloriesConsumed).toString()}
          unitSuffix={calSubtitle}
          remainingText={calRemaining}
          // Calorías es contexto, no presupuesto: su renglón va en tono quiet
          // (niebla, nota al pie) para no leerse como countdown (manifiesto).
          remainingTone="quiet"
          // Proteína es la métrica más cuidada (recomposición): se queda con
          // el magenta pleno y la tarjeta grande. Calorías recede un tono
          // (magenta profundo) para que el ojo aterrice primero en proteína,
          // sin sacar el dato del sistema de marca.
          ringColor={colors.magentaDeep}
          ringDelay={600}
          small
          onPress={editTargets}
        />
      </MacroCardWrap>
    </View>
  )
}

/* Per-card wrapper for the macros slide. ONE-SHOT ENTRANCE only —
 * a staggered `FadeInDown.springify().damping(13)` so the two cards
 * cascade in (Proteína first, Calorías ~160 ms behind). Fires on
 * mount; the cards never unmount inside the carousel so this is a
 * one-time reveal per session.
 *
 * The continuous "breath" Y-drift that used to live here was removed
 * — the cards staying still reads as more legible / less restless.
 * The aliveness now lives INSIDE the ring (see MacroRing's glow
 * breath), so the metric feels animated without the card itself
 * floating.
 *
 * Wraps `RingCard` instead of modifying it so other consumers
 * (anywhere else `RingCard` shows up) keep their static behaviour.
 */
function MacroCardWrap({ enterDelay, children }: { enterDelay: number; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <Animated.View
      style={styles.macroCardWrap}
      entering={
        reduce
          ? FadeIn.duration(220).delay(enterDelay)
          : FadeInDown.delay(enterDelay).springify().damping(13).mass(0.7)
      }
    >
      {children}
    </Animated.View>
  )
}

/* ─── Slide 2 — weight trend ───────────────────────────────────────── */

function fmtDelta(d: number): string {
  const sign = d < 0 ? '−' : d > 0 ? '+' : ''
  return `${sign}${Math.abs(d).toFixed(1)} kg`
}

function WeightSlide({ ctx }: { ctx: BriefContext }) {
  const { data: measurements } = useMeasurements(90)

  const points = useMemo<WeightPoint[]>(
    () => (measurements ? toWeightPoints(measurements) : []),
    [measurements],
  )

  const latest = points[points.length - 1]
  const first = points[0]
  const current = latest?.weight ?? ctx.latest_measurement?.weight_kg ?? null

  // Total change since the first logged measurement.
  const totalDelta = latest && first && points.length >= 2 ? latest.weight - first.weight : null

  // Weekly delta — latest vs the measurement closest to 7 days back.
  const weekDelta = useMemo<number | null>(() => {
    if (!latest || points.length < 2) return null
    const target = latest.t - WEEK_MS
    let ref: WeightPoint | null = null
    for (const p of points) {
      if (p === latest) continue
      if (ref == null || Math.abs(p.t - target) < Math.abs(ref.t - target)) ref = p
    }
    return ref ? latest.weight - ref.weight : null
  }, [points, latest])

  if (current == null) {
    return (
      <View style={[styles.slide, styles.emptyCard]}>
        <Text style={styles.emptyText}>Registra tu peso para ver tu tendencia aquí.</Text>
      </View>
    )
  }

  return (
    <View style={styles.slide}>
      <View style={styles.card}>
        <View style={styles.weightRow}>
          {points.length >= 2 ? (
            <WeightSparkline points={points} />
          ) : (
            <View style={styles.sparkPlaceholder} />
          )}
          <View style={styles.numberStack}>
            <View style={styles.weightTop}>
              <Text
                style={styles.weightValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {current.toFixed(1)}
              </Text>
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            {totalDelta != null ? (
              <Text style={[styles.totalLine, totalDelta < 0 && styles.deltaGood]}>
                {fmtDelta(totalDelta)} desde el inicio
              </Text>
            ) : (
              <Text style={styles.weeklyLine}>aún sin tendencia</Text>
            )}
            {weekDelta != null ? (
              <Text style={styles.weeklyLine}>{fmtDelta(weekDelta)} esta semana</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}

const SPARK_W = 130
const SPARK_H = 64
const SPARK_PAD = 7

/* Compact weight trend — a monotone magenta line with the current
 * weight marked by a dot at the tip. */
function WeightSparkline({ points }: { points: WeightPoint[] }) {
  const ts = points.map((p) => p.t)
  const ws = points.map((p) => p.weight)
  const tMin = Math.min(...ts)
  const tMax = Math.max(...ts)
  const wMin = Math.min(...ws)
  const wMax = Math.max(...ws)
  const tSpan = Math.max(1, tMax - tMin)
  const wSpan = Math.max(0.1, wMax - wMin)
  const x = (t: number) => SPARK_PAD + ((t - tMin) / tSpan) * (SPARK_W - 2 * SPARK_PAD)
  const y = (w: number) => SPARK_PAD + (1 - (w - wMin) / wSpan) * (SPARK_H - 2 * SPARK_PAD)

  const d =
    d3Line<WeightPoint>()
      .x((p) => x(p.t))
      .y((p) => y(p.weight))
      .curve(curveMonotoneX)(points) ?? ''
  const last = points[points.length - 1]!

  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Path
        d={d}
        stroke={colors.magenta}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={x(last.t)} cy={y(last.weight)} r={3.2} fill={colors.magenta} />
    </Svg>
  )
}

/* ─── Slide — last night's sleep ───────────────────────────────────── */

// 7 h 30 m — a neutral default shown (muted) before the night is
// logged, so the first tap is a small adjustment, not a guess.
const SLEEP_DEFAULT_MIN = 450
const SLEEP_MIN = 180 // 3 h
const SLEEP_MAX = 720 // 12 h
const SLEEP_STEP = 15
// A crescent — same moon glyph as the dinner meal slot.
const MOON = 'M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z'
const QUALITY_WORDS = ['inquieto', 'ligero', 'reparador', 'profundo', 'pleno'] as const

// The hours arc — a shallow bow the night fills left-to-right, giving
// the slide a "shape" like the weight sparkline. Geometry is fixed: a
// 150-wide chord rising 34 px to the apex → radius ≈ 99.7, swept
// length ≈ 170. Fill is 0 at 0 h, full at SLEEP_MAX (12 h).
const ARC_W = 160
const ARC_H = 46
const ARC_PATH = 'M 5 40 A 99.7 99.7 0 0 1 155 40'
const ARC_LEN = 170
const ARC_STROKE = 7

function clampDuration(n: number): number {
  return n < SLEEP_MIN ? SLEEP_MIN : n > SLEEP_MAX ? SLEEP_MAX : n
}

/*
 * Evaluación derivada de las horas — la usuaria solo registra cuánto
 * durmió y las lunas se encienden solas, según la distancia a la
 * franja 7–9 h (la referencia de descanso adulto). Es simétrica:
 * dormir bastante de más también baja lunas. El número se guarda en
 * `quality` igual que antes, así el motor de patrones de Órbita sigue
 * leyendo la misma columna sin cambios.
 */
function qualityFromDuration(minutes: number): number {
  const SWEET_LO = 420 // 7 h
  const SWEET_HI = 540 // 9 h
  const distance =
    minutes < SWEET_LO ? SWEET_LO - minutes : minutes > SWEET_HI ? minutes - SWEET_HI : 0
  if (distance === 0) return 5
  if (distance <= 30) return 4 // a media hora de la franja
  if (distance <= 90) return 3
  if (distance <= 150) return 2
  return 1
}

const AnimatedPath = Animated.createAnimatedComponent(Path)

/* The hours arc — a faint full track with a coloured progress arc on
 * top. The progress eases to its new length whenever duration steps;
 * before the night is logged it draws muted, matching the muted
 * duration number. */
function SleepArc({ fraction, muted }: { fraction: number; muted: boolean }) {
  const progress = useSharedValue(fraction)
  useEffect(() => {
    progress.value = withTiming(fraction, { duration: 420, easing: Easing.out(Easing.cubic) })
  }, [fraction, progress])

  // strokeDasharray is one full-length dash; the offset hides the
  // unfilled tail (offset = LEN → empty, 0 → full).
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LEN * (1 - progress.value),
  }))

  return (
    <Svg width={ARC_W} height={ARC_H}>
      <Path
        d={ARC_PATH}
        stroke={colors.bruma}
        strokeWidth={ARC_STROKE}
        strokeLinecap="round"
        fill="none"
      />
      <AnimatedPath
        d={ARC_PATH}
        stroke={muted ? colors.niebla : colors.magenta}
        strokeWidth={ARC_STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={ARC_LEN}
        animatedProps={animatedProps}
      />
    </Svg>
  )
}

/* A − / + chip for stepping the sleep duration. */
function StepButton({
  label,
  hint,
  onPress,
}: {
  label: string
  hint: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel={hint}
    >
      <Text style={styles.stepButtonLabel}>{label}</Text>
    </Pressable>
  )
}

/*
 * Last night's sleep — the only slide that registers, not just
 * displays. Sleep is a once-a-day morning ritual, so its home is
 * here on Hoy rather than the meal-centric QuickLog. Duration steps
 * in 15-min increments; the five moons are a READ-OUT, not an input —
 * they light up from the hours via qualityFromDuration, so logging is
 * one gesture (− / +), not two. The slide owns the edited values in
 * local state — the query only seeds them — so the UI is instant and
 * each change upserts in the background.
 */
function SleepSlide({ date }: { date: string }) {
  const { data: log, isLoading } = useSleepLog(date)
  const upsert = useUpsertSleep(date)

  const [draft, setDraft] = useState<SleepDraft | null>(null)
  const [touched, setTouched] = useState(false)

  // Seed the editable draft from the night's row — and RE-seed if the
  // row changes afterwards. Seeding only once dejaba un hueco: la cache
  // persistida hidrata `null` primero, el fetch real trae la fila
  // después, y el slide se quedaba mostrando el default apagado (lunas
  // sin encender) aunque la noche YA estaba registrada. Mientras la
  // usuaria no haya tocado − / + en esta sesión, la fila manda.
  useEffect(() => {
    if (isLoading || touched) return
    setDraft({
      durationMinutes: log?.duration_minutes ?? SLEEP_DEFAULT_MIN,
      quality: log?.quality ?? null,
    })
  }, [isLoading, log, touched])

  if (draft == null) {
    return <View style={[styles.slide, styles.card]} />
  }

  // A row exists once the night is logged or the user has touched it.
  const hasEntry = log != null || touched
  const h = Math.floor(draft.durationMinutes / 60)
  const m = draft.durationMinutes % 60
  const quality = qualityFromDuration(draft.durationMinutes)

  const step = (delta: number) => {
    const minutes = clampDuration(draft.durationMinutes + delta)
    if (minutes === draft.durationMinutes) return
    Haptics.selectionAsync().catch(() => {})
    // La calidad viaja derivada de las horas — un solo gesto registra
    // duración y evaluación juntas.
    const next: SleepDraft = { durationMinutes: minutes, quality: qualityFromDuration(minutes) }
    setDraft(next)
    setTouched(true)
    upsert.mutate(next)
  }

  return (
    <View style={styles.slide}>
      <View style={[styles.card, styles.sleepCard]}>
        {/* The hours-arc gauge with the duration nested in its bow,
            flanked by the − / + chips that grow and shrink it. */}
        <View style={styles.sleepGaugeRow}>
          <StepButton label="−" hint="Restar 15 minutos" onPress={() => step(-SLEEP_STEP)} />
          <View style={styles.sleepGauge}>
            <SleepArc fraction={draft.durationMinutes / SLEEP_MAX} muted={!hasEntry} />
            <View style={styles.sleepValueWrap}>
              <Text style={[styles.weightValue, !hasEntry && styles.sleepValueMuted]}>{h}</Text>
              <Text style={styles.sleepUnit}>h</Text>
              {m > 0 ? (
                <>
                  <Text
                    style={[
                      styles.weightValue,
                      styles.sleepMinutes,
                      !hasEntry && styles.sleepValueMuted,
                    ]}
                  >
                    {m}
                  </Text>
                  <Text style={styles.sleepUnit}>m</Text>
                </>
              ) : null}
            </View>
          </View>
          <StepButton label="+" hint="Sumar 15 minutos" onPress={() => step(SLEEP_STEP)} />
        </View>

        {/* Las lunas son una lectura, no un input — se encienden solas
            según las horas mostradas, desde el primer render. Con la
            noche registrada van en magenta; antes de registrar, en
            niebla (la misma señal "aún no es tuyo" del arco y el
            número), pero la evaluación SIEMPRE se ve. */}
        <View
          style={styles.sleepQualityRow}
          accessibilityLabel={`Sueño ${QUALITY_WORDS[quality - 1]}, ${quality} de 5 lunas`}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Svg key={i} width={26} height={26} viewBox="0 0 24 24">
              <Path
                d={MOON}
                fill={quality > i ? (hasEntry ? colors.magenta : colors.niebla) : colors.bruma}
              />
            </Svg>
          ))}
        </View>

        {!hasEntry ? (
          <Text style={styles.captionLine}>¿Cuánto dormiste anoche?</Text>
        ) : (
          <Text style={styles.captionLine}>
            Sueño <Text style={styles.captionEm}>{QUALITY_WORDS[quality - 1]}</Text>
          </Text>
        )}
      </View>
    </View>
  )
}

/* ─── Slide — this morning's check-in ──────────────────────────────── */

/*
 * This morning's check-in — el ánimo (MoodSliderInline, 1 eje) + una NOTA
 * libre opcional (daily_notes). Reemplazó el detalle de energía/motivación/
 * calma (3 ejes): decisión de producto (jul 2026) — la usuaria escribe una
 * nota en vez de calificar 3 escalas. Nota: Órbita ya no recibe energía/mente
 * desde esta tarjeta.
 */
function WellbeingSlide({
  date,
  onLockPager,
  pagerGesture,
  scrollX,
  slideIndex,
  slideW,
}: {
  date: string
  onLockPager?: (locked: boolean) => void
  pagerGesture?: NativeGesture
  /** Para gatear el gesto del mood a "slide centrada" (ver MoodSliderInline). */
  scrollX?: SharedValue<number>
  slideIndex?: number
  slideW?: number
}) {
  return (
    <View style={styles.slide}>
      <View style={[styles.card, styles.wellbeingCard]}>
        {/* Ánimo (1 eje) — el registro primario, MISMO gesto que Órbita. */}
        <MoodSliderInline
          date={date}
          onDragActive={onLockPager}
          pagerGesture={pagerGesture}
          scrollX={scrollX}
          slideIndex={slideIndex}
          slideW={slideW}
        />

        {/* Nota libre del día (daily_notes) — SIEMPRE visible, reemplaza el
            detalle de energía/motivación/calma. */}
        <DailyNoteInline date={date} />
      </View>
    </View>
  )
}

/* ─── Slide — cycle phase ──────────────────────────────────────────── */

/*
 * Cycle phase — answers "¿dónde estoy hoy?" as a journey, not a day count.
 * A hero (the phase you're in) + a horizontal timeline (where you've been,
 * where you are, what's next) + the single next milestone. Read-only and
 * deterministic from the user's own period anchor; inputs live in QuickLog ✦.
 * The journey UI is shared with the (fuller) Progreso card via
 * features/cycle/components/CycleTimeline.
 */
function CycleSlide({
  cycle,
}: {
  cycle: { day: number; phase: CyclePhase; length: number; daysToNext: number }
}) {
  return (
    <View style={styles.slide}>
      <View
        style={styles.card}
        accessible
        accessibilityLabel={`Tu ciclo. ${PHASE_LABEL[cycle.phase]}, día ${cycle.day} de ${cycle.length}. ${nextMilestoneLine(cycle.day, cycle.length)}`}
      >
        <CyclePhaseHero phase={cycle.phase} day={cycle.day} length={cycle.length} />
        <CycleTimeline phase={cycle.phase} />
        <CycleNextMilestone day={cycle.day} length={cycle.length} />
      </View>
    </View>
  )
}

/* ─── Pagination dots ──────────────────────────────────────────────── */

function Dots({
  count,
  active,
  showHint,
  onDotPress,
}: {
  count: number
  active: number
  /** When true, a bouncing `›` is rendered to the right of the dots
   *  as a "swipe more" affordance. Hidden once the user has paged
   *  past the first slide. */
  showHint: boolean
  /** Tap-to-jump: cada dot scrollea directo a su slide. */
  onDotPress: (index: number) => void
}) {
  return (
    <View style={styles.dotsWrap}>
      <View style={styles.dots}>
        {Array.from({ length: count }).map((_, i) => (
          <Pressable
            key={i}
            hitSlop={10}
            onPress={() => onDotPress(i)}
            accessibilityRole="button"
            accessibilityLabel={`Ir a la tarjeta ${i + 1} de ${count}`}
          >
            <Dot on={i === active} />
          </Pressable>
        ))}
        {showHint ? <SwipeHint /> : null}
      </View>
      {/* Temporary text hint — hides for good after the first swipe. */}
      {showHint ? <Text style={styles.swipeHintText}>Desliza para ver más</Text> : null}
    </View>
  )
}

function Dot({ on }: { on: boolean }) {
  const p = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 260 })
  }, [on, p])
  const style = useAnimatedStyle(() => ({
    width: 7 + p.value * 13,
    // Higher floor so inactive dots read clearly as "more pages here".
    opacity: 0.45 + p.value * 0.55,
  }))
  return <Animated.View style={[styles.dot, style]} />
}

/* Bouncing `›` glyph that signals "more slides to the right" without
 * adding chrome. Loops `translateX` 0 → 4 → 0 over 1.2 s on an
 * inOut sine — the bounce is what catches the eye; a static chevron
 * would read as decoration. Reduce-motion rests it at the midpoint
 * (still visible, just not moving). Color matches the dots' magenta
 * but at lower opacity so it doesn't compete with the active dot.
 */
function SwipeHint() {
  const reduce = useReducedMotion()
  const x = useSharedValue(reduce ? 0.5 : 0)

  useEffect(() => {
    if (reduce) return
    x.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [x, reduce])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 4 }],
    opacity: 0.55 + x.value * 0.35,
  }))

  return (
    <Animated.Text style={[styles.hint, style]} accessibilityElementsHidden>
      ›
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  header: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Strategy chip: quiet pill, magenta dot + bone label, hairline border.
  enfoqueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  enfoqueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
  enfoqueChipText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    color: colors.bone,
  },
  measurePlaceholder: {
    height: 150,
  },
  slide: {
    // Altura uniforme para TODAS las slides → el carrusel no salta al pasar de
    // una card corta (peso) a una alta (ciclo/macros). La card interna (flex:1)
    // llena esta altura y centra su contenido.
    minHeight: 224,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 14,
  },
  // Per-card wrapper inside the macros slide. `flex: 1` so the two
  // wrapped cards still share the row evenly (RingCard's own column
  // is `flex: 1`; we mirror that here so wrapping doesn't collapse
  // the cards to their intrinsic width).
  macroCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  // Weight card — same chrome as the macro RingCards so the slides
  // read as one family.
  card: {
    flex: 1,
    backgroundColor: 'rgba(244,236,222,0.035)',
    borderColor: colors.bruma,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  sparkPlaceholder: {
    width: SPARK_W,
    height: SPARK_H,
  },
  numberStack: {
    flex: 1,
    minWidth: 0,
  },
  weightTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  weightValue: {
    fontFamily: typography.displayHeavy,
    fontSize: 44,
    color: colors.leche,
    letterSpacing: -1.8,
    lineHeight: 46,
  },
  weightUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    color: colors.niebla,
  },
  // Total change — the headline of progress.
  totalLine: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.bone,
  },
  deltaGood: {
    color: colors.magenta,
  },
  // Weekly pace — quieter, secondary.
  weeklyLine: {
    marginTop: 3,
    fontFamily: typography.ui,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  emptyCard: {
    backgroundColor: 'rgba(244,236,222,0.035)',
    borderColor: colors.bruma,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.niebla,
    textAlign: 'center',
  },
  // ── Sleep slide ────────────────────────────────────────────────
  // The card's children stacked with even breathing room.
  sleepCard: {
    gap: 14,
  },
  // The − chip · arc gauge · + chip, kept as one centred cluster.
  sleepGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // The arc and the duration, stacked — the number tucks up into the
  // arc's bow via the value row's negative margin.
  sleepGauge: {
    alignItems: 'center',
  },
  sleepValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: -22,
  },
  // The h / m units — small, serif, tucked tight against their number.
  sleepUnit: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
    marginLeft: 2,
  },
  // Space before the minutes number, separating the two h·m groups.
  sleepMinutes: {
    marginLeft: 8,
  },
  // Before the night is logged the duration is a muted suggestion.
  sleepValueMuted: {
    color: colors.niebla,
  },
  // − / + button — clearer button chrome (elevated fill + stronger border +
  // leche glyph) so it reads as a control, not decoration. Magenta-tint flash
  // on press confirms the tap.
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPressed: {
    opacity: 0.7,
    backgroundColor: colors.magentaTint,
    borderColor: colors.magenta,
  },
  stepButtonLabel: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 24,
    color: colors.leche,
  },
  sleepQualityRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  // ── Wellbeing slide ────────────────────────────────────────────
  wellbeingCard: {
    gap: 13,
  },
  // ── Cycle slide ────────────────────────────────────────────────
  // The dial holds the day number stacked at its centre.
  // Cycle slide chrome lives in features/cycle/components/CycleTimeline
  // (shared with Progreso); only styles.slide + styles.card wrap it here.
  // ── Shared caption — the serif italic line under a slide. ──────
  captionLine: {
    textAlign: 'center',
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.niebla,
  },
  captionEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
  dotsWrap: {
    alignItems: 'center',
    marginTop: 14,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
  },
  dot: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.magenta,
  },
  swipeHintText: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  // Swipe affordance — sits to the right of the dots, marginLeft 4
  // so it reads as part of the pagination cluster, not detached.
  // Magenta to tie to the dots; opacity is animated in JS-side.
  hint: {
    fontFamily: typography.uiBold,
    fontSize: 20,
    lineHeight: 20,
    color: colors.magenta,
    marginLeft: 6,
    // Glyph metrics push it slightly low; nudge up so it lines up
    // with the dot vertical centre.
    marginTop: -8,
  },
})
