import { curveMonotoneX, line as d3Line } from 'd3-shape'
import * as Haptics from 'expo-haptics'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import type { BriefContext } from '@/features/brief/api'
import { useMeasurements } from '@/features/progress/hooks'
import { toWeightPoints, type WeightPoint } from '@/features/progress/logic'
import type { SleepDraft } from '@/features/sleep/api'
import { useSleepLog, useUpsertSleep } from '@/features/sleep/hooks'
import type { WellbeingDraft } from '@/features/wellbeing/api'
import { useSaveWellbeing, useTodayWellbeing } from '@/features/wellbeing/hooks'
import { colors, typography } from '@/theme'

import { RingCard } from './RingCard'

// Macros lead — the day's most-checked number — then the morning
// rituals (sleep, check-in), the cycle phase (read-only, reframes
// the rest), and the slow weight trend. Water lives in the QuickLog
// (✦); registering it here too would duplicate that.
const SLIDE_TITLES = [
  'Macros de hoy',
  'Sueño de anoche',
  'Cómo amaneciste',
  'Tu ciclo',
  'Tu peso',
] as const
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

type Props = { ctx: BriefContext }

/**
 * The Hoy-tab stat slider — a paged carousel whose section title
 * changes per slide: today's macros, last night's sleep, the morning
 * check-in, the weight trend. Sleep and the check-in register inline
 * (once-a-day morning rituals, not QuickLog actions); macros and
 * weight are read-only views. Pagination dots track the position;
 * the title cross-fades as the slider pages.
 */
export function StatSlider({ ctx }: Props) {
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState(0)

  // Live scroll offset — drives the per-slide enter/leave animation.
  const scrollX = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== width) setWidth(w)
  }

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return
    const idx = Math.round(e.nativeEvent.contentOffset.x / width)
    if (idx !== active && idx >= 0 && idx < SLIDE_TITLES.length) setActive(idx)
  }

  return (
    <View onLayout={onLayout}>
      <View style={styles.header}>
        {/* Re-keyed on `active` so the title cross-fades when paging. */}
        <Animated.View key={active} entering={FadeIn.duration(280)}>
          <EyebrowLabel tone="magenta">{SLIDE_TITLES[active] ?? ''}</EyebrowLabel>
        </Animated.View>
      </View>

      {width > 0 ? (
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          <Slide index={0} width={width} scrollX={scrollX}>
            <MacroSlide ctx={ctx} />
          </Slide>
          <Slide index={1} width={width} scrollX={scrollX}>
            <SleepSlide date={ctx.date} />
          </Slide>
          <Slide index={2} width={width} scrollX={scrollX}>
            <WellbeingSlide date={ctx.date} />
          </Slide>
          <Slide index={3} width={width} scrollX={scrollX}>
            <CycleSlide />
          </Slide>
          <Slide index={4} width={width} scrollX={scrollX}>
            <WeightSlide ctx={ctx} />
          </Slide>
        </Animated.ScrollView>
      ) : (
        <View style={styles.measurePlaceholder} />
      )}

      <Dots count={SLIDE_TITLES.length} active={active} />
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

/* ─── Slide 1 — today's macros ─────────────────────────────────────── */

function MacroSlide({ ctx }: { ctx: BriefContext }) {
  if (!ctx.targets) {
    return (
      <View style={[styles.slide, styles.emptyCard]}>
        <Text style={styles.emptyText}>Configura tus metas para ver tus macros.</Text>
      </View>
    )
  }
  // Calories — a speedometer gauge that exceeds when consumed > target.
  // The big number is what you've eaten today; the subtitle adapts to
  // under / at / over the target. Going over is informational (warm
  // amber, not red), so it's visible without being a verdict.
  const caloriesConsumed = ctx.today_macros.calories
  const caloriesTarget = ctx.targets.calories
  const calOver = Math.max(0, Math.round(caloriesConsumed - caloriesTarget))
  const calRemaining = Math.max(0, Math.round(caloriesTarget - caloriesConsumed))
  const calSubtitle =
    calOver > 0
      ? `+${calOver} kcal sobre tu meta`
      : calRemaining > 0
        ? `de ${caloriesTarget} kcal · faltan ${calRemaining}`
        : `de ${caloriesTarget} kcal · llegaste`
  return (
    <View style={[styles.slide, styles.macroRow]}>
      <RingCard
        label="Proteína"
        value={ctx.today_macros.protein_g}
        target={ctx.targets.protein_g}
        formatted={Math.round(ctx.today_macros.protein_g).toString()}
        unitSuffix={`/ ${ctx.targets.protein_g} g`}
        ringColor={colors.magenta}
        ringDelay={400}
      />
      <RingCard
        speedometer
        label="Calorías"
        value={caloriesConsumed}
        target={caloriesTarget}
        formatted={Math.round(caloriesConsumed).toString()}
        unitSuffix={calSubtitle}
        ringColor={colors.magenta}
        ringDelay={600}
        small
      />
    </View>
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
      style={styles.stepButton}
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
 * in 15-min increments; quality is five tappable moons. The slide
 * owns the edited values in local state — the query only seeds them
 * — so the UI is instant and each change upserts in the background.
 */
function SleepSlide({ date }: { date: string }) {
  const { data: log, isLoading } = useSleepLog(date)
  const upsert = useUpsertSleep(date)

  const [draft, setDraft] = useState<SleepDraft | null>(null)
  const [touched, setTouched] = useState(false)

  // Seed the editable draft once the night's row (or its absence) loads.
  useEffect(() => {
    if (isLoading || draft != null) return
    setDraft({
      durationMinutes: log?.duration_minutes ?? SLEEP_DEFAULT_MIN,
      quality: log?.quality ?? null,
    })
  }, [isLoading, log, draft])

  if (draft == null) {
    return <View style={[styles.slide, styles.card]} />
  }

  // A row exists once the night is logged or the user has touched it.
  const hasEntry = log != null || touched
  const h = Math.floor(draft.durationMinutes / 60)
  const m = draft.durationMinutes % 60

  const commit = (next: SleepDraft) => {
    setDraft(next)
    setTouched(true)
    upsert.mutate(next)
  }
  const step = (delta: number) => {
    const minutes = clampDuration(draft.durationMinutes + delta)
    if (minutes === draft.durationMinutes) return
    Haptics.selectionAsync().catch(() => {})
    commit({ ...draft, durationMinutes: minutes })
  }
  const rate = (i: number) => {
    Haptics.selectionAsync().catch(() => {})
    // Tap a moon to set the quality; tap the current top moon to
    // step one back down — mirrors the water glasses' behaviour.
    const next = draft.quality === i + 1 ? (i === 0 ? null : i) : i + 1
    commit({ ...draft, quality: next })
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

        <View style={styles.sleepQualityRow}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Pressable
              key={i}
              onPress={() => rate(i)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Calidad ${i + 1} de 5`}
            >
              <Svg width={26} height={26} viewBox="0 0 24 24">
                <Path d={MOON} fill={(draft.quality ?? 0) > i ? colors.magenta : colors.bruma} />
              </Svg>
            </Pressable>
          ))}
        </View>

        {!hasEntry ? (
          <Text style={styles.captionLine}>¿Cuánto dormiste anoche?</Text>
        ) : draft.quality == null ? (
          <Text style={styles.captionLine}>Toca las lunas para la calidad</Text>
        ) : (
          <Text style={styles.captionLine}>
            Sueño <Text style={styles.captionEm}>{QUALITY_WORDS[draft.quality - 1]}</Text>
          </Text>
        )}
      </View>
    </View>
  )
}

/* ─── Slide — this morning's check-in ──────────────────────────────── */

const WELLBEING_AXES = [
  { key: 'energy', label: 'Energía', invert: false },
  { key: 'motivation', label: 'Motivación', invert: false },
  // The DB column is `stress`, but the slide asks for its opposite,
  // Calma — so all three axes read "more = better" and a fully lit
  // row is unambiguously a good morning. Stored value = 6 − calma.
  { key: 'stress', label: 'Calma', invert: true },
] as const

type WellbeingAxis = (typeof WELLBEING_AXES)[number]

const ENERGY_WORDS = ['en reserva', 'baja', 'estable', 'en alza', 'radiante'] as const

// A 4-point star — the app's celestial glyph. Here it's a rating
// that lights up: rated levels glow, the rest stay as dim embers.
const STAR = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

// Taps coalesce: adjusting an axis fires one write 350 ms after the
// last touch, so a multi-axis check-in doesn't spray rows.
const WELLBEING_DEBOUNCE_MS = 350

/** The 1–5 value shown for an axis — inverted axes show 6 − stored. */
function shownValue(axis: WellbeingAxis, draft: WellbeingDraft): number | null {
  const stored = draft[axis.key]
  if (stored == null) return null
  return axis.invert ? 6 - stored : stored
}

/* One 1–5 axis — five levels that light from embers into glowing
 * stars as it's rated. */
function AxisStars({ value, onRate }: { value: number | null; onRate: (i: number) => void }) {
  const lit = value ?? 0
  return (
    <View style={styles.starsRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Pressable
          key={i}
          onPress={() => onRate(i)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${i + 1} de 5`}
          style={styles.starSlot}
        >
          {lit > i ? (
            <View style={styles.starGlow}>
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d={STAR} fill={colors.magenta} />
              </Svg>
            </View>
          ) : (
            <View style={styles.ember} />
          )}
        </Pressable>
      ))}
    </View>
  )
}

/*
 * This morning's check-in — energy, motivation and calm on a 1–5
 * scale. Like the sleep slide it registers inline (a once-a-day
 * ritual, not a QuickLog action) and feeds two órbita dimensions:
 * energía and mente. The slide owns the draft; taps are debounced
 * into one write, and later edits update that same row in place.
 */
function WellbeingSlide({ date }: { date: string }) {
  const { data: row, isLoading } = useTodayWellbeing(date)
  const save = useSaveWellbeing(date)

  const [draft, setDraft] = useState<WellbeingDraft | null>(null)
  const [touched, setTouched] = useState(false)
  // Row id and debounce timer live in refs so a tap reads their
  // latest value without the draft effect re-running.
  const rowId = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Seed the editable draft once today's check-in (or its absence) loads.
  useEffect(() => {
    if (isLoading || draft != null) return
    setDraft({
      energy: row?.energy ?? null,
      motivation: row?.motivation ?? null,
      stress: row?.stress ?? null,
    })
    rowId.current = row?.id ?? null
  }, [isLoading, row, draft])

  // Drop a still-pending write when the slide unmounts.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  if (draft == null) {
    return <View style={[styles.slide, styles.card]} />
  }

  // A row exists once the check-in is logged or the user has touched it.
  const hasEntry = row != null || touched

  const rate = (axis: WellbeingAxis, i: number) => {
    Haptics.selectionAsync().catch(() => {})
    // Tap a star to set the level; tap the current top star to step
    // back. The step works on the shown value, then converts to the
    // stored one (inverted for Calma).
    const shown = shownValue(axis, draft)
    const nextShown = shown === i + 1 ? (i === 0 ? null : i) : i + 1
    const stored = nextShown == null ? null : axis.invert ? 6 - nextShown : nextShown
    const nextDraft = { ...draft, [axis.key]: stored }
    setDraft(nextDraft)
    setTouched(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      save.mutate(
        { id: rowId.current, draft: nextDraft },
        { onSuccess: (saved) => (rowId.current = saved?.id ?? null) },
      )
    }, WELLBEING_DEBOUNCE_MS)
  }

  return (
    <View style={styles.slide}>
      <View style={[styles.card, styles.wellbeingCard]}>
        {WELLBEING_AXES.map((axis) => (
          <View key={axis.key} style={styles.axisRow}>
            <Text style={styles.axisLabel}>{axis.label}</Text>
            <AxisStars value={shownValue(axis, draft)} onRate={(i) => rate(axis, i)} />
          </View>
        ))}

        {!hasEntry ? (
          <Text style={styles.captionLine}>¿Cómo te sientes hoy?</Text>
        ) : draft.energy != null ? (
          <Text style={styles.captionLine}>
            Energía <Text style={styles.captionEm}>{ENERGY_WORDS[draft.energy - 1]}</Text>
          </Text>
        ) : (
          <Text style={styles.captionLine}>Check-in guardado</Text>
        )}
      </View>
    </View>
  )
}

/* ─── Slide — cycle phase ──────────────────────────────────────────── */

// Mock — derivation from cycle_events is deferred to the cycle
// lifecycle sprint. Day 22 / fase lútea matches the Voz de Stelar
// copy in features/orbit/mock.ts so the two surfaces tell the same
// story while this slide is still on placeholder data.
const MOCK_CYCLE = {
  day: 22,
  cycleLength: 28,
  daysToNextPeriod: 6,
}

type CyclePhase = 'menstrual' | 'folicular' | 'ovulación' | 'lútea'

function phaseForDay(day: number): CyclePhase {
  if (day <= 5) return 'menstrual'
  if (day <= 13) return 'folicular'
  if (day <= 16) return 'ovulación'
  return 'lútea'
}

// Dial — a full ring of the cycle's days, the lit arc growing from
// the top clockwise to today and tipped with a small marker. Visual
// rhyme with the weight sparkline (a curve + a tip dot).
const DIAL_W = 130
const DIAL_H = 130
const DIAL_R = 52
const DIAL_CX = DIAL_W / 2
const DIAL_CY = DIAL_H / 2
const DIAL_CIRC = 2 * Math.PI * DIAL_R

function CycleDial({ day, cycleLength }: { day: number; cycleLength: number }) {
  const fraction = Math.min(1, day / cycleLength)
  const filled = DIAL_CIRC * fraction
  // Start at top (−90°), sweep clockwise.
  const angle = fraction * 2 * Math.PI - Math.PI / 2
  const markerX = DIAL_CX + DIAL_R * Math.cos(angle)
  const markerY = DIAL_CY + DIAL_R * Math.sin(angle)

  return (
    <Svg width={DIAL_W} height={DIAL_H}>
      <Circle
        cx={DIAL_CX}
        cy={DIAL_CY}
        r={DIAL_R}
        stroke={colors.bruma}
        strokeWidth={2}
        fill="none"
      />
      <Circle
        cx={DIAL_CX}
        cy={DIAL_CY}
        r={DIAL_R}
        stroke={colors.magenta}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${DIAL_CIRC}`}
        transform={`rotate(-90 ${DIAL_CX} ${DIAL_CY})`}
      />
      <Circle cx={markerX} cy={markerY} r={3.6} fill={colors.magenta} />
    </Svg>
  )
}

/*
 * Cycle phase — a read-only snapshot of where the user is in her
 * menstrual cycle today. Phase reframes the rest of the dashboard
 * (calories, sleep, mood), which is why it lives next to them on Hoy.
 * Inputs (period start / end) belong in QuickLog ✦, not this slide.
 */
function CycleSlide() {
  const { day, cycleLength, daysToNextPeriod } = MOCK_CYCLE
  const phase = phaseForDay(day)

  return (
    <View style={styles.slide}>
      <View style={styles.card}>
        <View style={styles.weightRow}>
          <View style={styles.cycleDialWrap}>
            <CycleDial day={day} cycleLength={cycleLength} />
            <View style={styles.cycleDialCenter} pointerEvents="none">
              <Text style={styles.cycleDialDay}>{day}</Text>
              <Text style={styles.cycleDialOf}>/ {cycleLength}</Text>
            </View>
          </View>
          <View style={styles.numberStack}>
            <Text style={styles.cyclePhaseLine}>
              Fase <Text style={styles.cyclePhaseEm}>{phase}</Text>
            </Text>
            <Text style={styles.weeklyLine}>regla en {daysToNextPeriod} días</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

/* ─── Pagination dots ──────────────────────────────────────────────── */

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <Dot key={i} on={i === active} />
      ))}
    </View>
  )
}

function Dot({ on }: { on: boolean }) {
  const p = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 260 })
  }, [on, p])
  const style = useAnimatedStyle(() => ({
    width: 6 + p.value * 12,
    opacity: 0.32 + p.value * 0.68,
  }))
  return <Animated.View style={[styles.dot, style]} />
}

const styles = StyleSheet.create({
  header: {
    marginTop: 22,
    marginBottom: 12,
  },
  measurePlaceholder: {
    height: 150,
  },
  slide: {
    minHeight: 150,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 14,
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
  // − / + chip — same bordered surface as the header gear button.
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonLabel: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.segmentTitle,
    lineHeight: 24,
    color: colors.bone,
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
  // Label + stars as one centred cluster; the fixed label width
  // keeps the three star columns aligned.
  axisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisLabel: {
    width: 104,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  starsRow: {
    flexDirection: 'row',
  },
  // Fixed slot so a lit star and a dim ember occupy the same box.
  starSlot: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A rated level — the star sits on a soft magenta glow.
  starGlow: {
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 5,
    shadowOpacity: 0.75,
    elevation: 4,
  },
  // An unrated level — a dim ember.
  ember: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.bruma,
  },
  // ── Cycle slide ────────────────────────────────────────────────
  // The dial holds the day number stacked at its centre.
  cycleDialWrap: {
    width: DIAL_W,
    height: DIAL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleDialCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Day N — the headline number, sized like the weight value.
  cycleDialDay: {
    fontFamily: typography.displayHeavy,
    fontSize: 38,
    color: colors.leche,
    letterSpacing: -1.6,
    lineHeight: 40,
  },
  // "/ 28" — small, serif, sitting just under the day number.
  cycleDialOf: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  // Phase headline — serif italic like the weight's total delta line.
  cyclePhaseLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  // Phase name — the emphasised word, magenta serif.
  cyclePhaseEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
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
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
})
