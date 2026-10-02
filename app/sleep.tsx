import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Line, Rect } from 'react-native-svg'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useBriefContext } from '@/features/brief/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { sleepDeficitLink } from '@/features/orbit/sleep-link'
import { SkyBackground } from '@/features/tabs/components'
import { MoonGlyph } from '@/features/tabs/components/check-in-glyphs'
import { WatchMark } from '@/features/wearables/components/WatchMark'
import { useWearableSleepNights } from '@/features/wearables/hooks'
import { formatSleepShort } from '@/features/wearables/recovery'
import {
  addDaysIso,
  barLabel,
  bedtimeLabel,
  bedtimeRead,
  clockTime,
  lastSevenNights,
  stageSegments,
  usualSleep,
  type BedtimeBar,
  type StageKey,
  type StageSegment,
} from '@/features/wearables/sleep-detail'
import { todayInTimezone, userTimezone } from '@/lib/time'
import { colors, radius, typography } from '@/theme'

/*
 * Tu sueño (dueña 2 oct 2026: "más cercano al Sleep Score de Apple, con
 * nuestros colores, inspiración y no copia").
 *
 * Toma la ESTRUCTURA de Apple (tarjeta principal con anillo + leyenda, dos
 * tiles, una "highlight" con la gráfica de la hora de dormir) pero NO su
 * calificación: Stelar no le pone nota a la noche (84/100 juzga). El anillo es
 * la COMPOSICIÓN de la noche (sus etapas); la comparación es siempre contra TI
 * (tu normal, tu promedio de hora de dormir). El sueño no es meta propia:
 * alimenta el déficit, y la tarjeta final lo conecta con Descubre.
 */
export default function SleepScreen() {
  return (
    <ErrorBoundary screen="sueno">
      <SleepBody />
    </ErrorBoundary>
  )
}

// La noche se queda en el índigo del sueño (su color en toda la app: Hoy,
// Descubre, Tu smartwatch); lo Stelar va en el ORO (etiquetas, tu promedio, la
// luna) y en el negro cálido de las tarjetas con su filo dorado.
const NOCHE = colors.dimension.sueno
const ACCENT = colors.oroSoft
const STAGE_COLOR: Record<StageKey, string> = {
  deep: colors.sleepStage.deep,
  core: colors.sleepStage.core,
  rem: colors.sleepStage.rem,
  awake: colors.sleepStage.awake,
}

const MONTHS = [
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

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[(m ?? 1) - 1]}`
}

const BAR_MAX = 64
const CHART_H = 96

/** "18 min" / "1 h 04": duraciones cortas legibles (etapas, diferencias). */
function fmtDuration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/** La frase de la highlight: el hecho contra TU promedio, sin culpa. */
function bedtimeHighlight(diff: number): string {
  const d = Math.abs(diff)
  if (d < 10) return 'Te dormiste a tu hora de siempre.'
  return diff > 0
    ? `Te dormiste ${d} min más tarde que tu promedio.`
    : `Te dormiste ${d} min más temprano que tu promedio.`
}

function SleepBody() {
  const router = useRouter()
  const tz = userTimezone()
  const params = useLocalSearchParams<{ date?: string }>()
  const today = todayInTimezone(tz)
  const date = typeof params.date === 'string' && params.date ? params.date : today
  const isToday = date === today

  const nights = useWearableSleepNights(addDaysIso(date, -13), date)
  const history = useSignalsHistory(90)
  const brief = useBriefContext()

  const minutesByDay = new Map<string, number>()
  for (const s of history.data ?? []) {
    if (s.day && s.sleep_minutes != null) minutesByDay.set(s.day, s.sleep_minutes)
  }
  const night = nights.data?.find((n) => n.sleep_date === date) ?? null
  const minutes = minutesByDay.get(date) ?? night?.asleep_minutes ?? null
  // Si la noche que manda es la manual, el reloj no la describe.
  const watchDescribes = night != null && night.asleep_minutes === minutes
  const stages = watchDescribes ? stageSegments(night) : null

  const bars = lastSevenNights(date, minutesByDay)
  const usual = usualSleep([...minutesByDay.values()])
  const barScale = Math.max(600, ...bars.map((b) => b.minutes ?? 0))
  const bed = bedtimeRead(nights.data ?? [], date, tz)
  const link = sleepDeficitLink(history.data ?? [], brief.data?.targets?.calories ?? null)
  const vsUsual = minutes != null && usual != null ? minutes - usual : null

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={styles.back}
          >
            <Feather name="chevron-left" size={24} color={colors.leche} />
          </Pressable>
          <Text style={styles.title}>Tu sueño</Text>
          <View style={styles.back} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* ── La noche: anillo de etapas + leyenda (sin nota) ── */}
          <Animated.View entering={FadeInDown.duration(320)}>
            <LinearGradient
              colors={[`${NOCHE}22`, colors.bgCard2, colors.bgCard]}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroHead}>
                <Text style={styles.kicker}>
                  {isToday ? 'Anoche' : `La noche del ${dayLabel(date)}`}
                </Text>
                {watchDescribes ? <WatchMark past={!isToday} size={12} inline={false} /> : null}
              </View>
              {minutes != null ? (
                <View style={styles.heroBody}>
                  <View style={styles.heroText}>
                    <Text style={styles.heroValue}>{formatSleepShort(minutes)}</Text>
                    {watchDescribes && night.bedtime_at && night.wake_at ? (
                      <Text style={styles.heroWindow}>
                        {`${clockTime(night.bedtime_at, tz)} a ${clockTime(night.wake_at, tz)}`}
                      </Text>
                    ) : null}
                    {stages ? (
                      <View style={styles.legend}>
                        {stages.map((s) => (
                          <View key={s.key} style={styles.legendRow}>
                            <View
                              style={[styles.legendDot, { backgroundColor: STAGE_COLOR[s.key] }]}
                            />
                            <Text style={styles.legendLabel}>{s.label}</Text>
                            <Text style={styles.legendValue}>{fmtDuration(s.minutes)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.muted}>
                        {watchDescribes
                          ? 'Tu reloj no mandó las etapas de esta noche.'
                          : 'Las etapas aparecen cuando la noche llega de tu reloj.'}
                      </Text>
                    )}
                  </View>
                  <StageRing stages={stages} />
                </View>
              ) : (
                <Text style={styles.empty}>Todavía no hay sueño de esta noche.</Text>
              )}
            </LinearGradient>
          </Animated.View>

          {/* ── Dos tiles: tu noche contra tu normal · tu hora de dormir ── */}
          {minutes != null ? (
            <Animated.View entering={FadeInDown.duration(320).delay(90)} style={styles.tiles}>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Contra tu normal</Text>
                <Text style={styles.tileValue}>
                  {vsUsual == null
                    ? '—'
                    : Math.abs(vsUsual) < 10
                      ? 'Igual'
                      : `${vsUsual > 0 ? '+' : '−'}${fmtDuration(Math.abs(vsUsual))}`}
                </Text>
                <Text style={styles.tileCaption}>
                  {usual != null ? `tu normal: ${formatSleepShort(usual)}` : 'aún sin tu normal'}
                </Text>
              </View>
              <View style={styles.tile}>
                <Text style={styles.tileLabel}>Te dormiste</Text>
                <Text style={styles.tileValue}>
                  {bed.last != null ? bedtimeLabel(bed.last) : '—'}
                </Text>
                <Text style={styles.tileCaption}>
                  {bed.average != null
                    ? `tu promedio: ${bedtimeLabel(bed.average)}`
                    : 'hora de dormir'}
                </Text>
              </View>
            </Animated.View>
          ) : null}

          {/* ── La highlight: tu hora de dormir, 14 noches contra tu promedio ── */}
          {bed.average != null && bed.last != null ? (
            <Animated.View entering={FadeInDown.duration(320).delay(160)} style={styles.card}>
              <View style={styles.cardHead}>
                <MoonGlyph color={ACCENT} size={16} />
                <Text style={[styles.cardKicker, { color: ACCENT }]}>Hora de dormir</Text>
              </View>
              <Text style={styles.highlight}>{bedtimeHighlight(bed.diff ?? 0)}</Text>
              <View style={styles.compareRow}>
                <View>
                  <Text style={styles.compareLabel}>Tu promedio</Text>
                  <Text style={[styles.compareValue, { color: ACCENT }]}>
                    {bedtimeLabel(bed.average)}
                  </Text>
                </View>
                <View style={styles.compareRight}>
                  <Text style={styles.compareLabel}>{isToday ? 'Anoche' : 'Esa noche'}</Text>
                  <Text style={[styles.compareValue, { color: NOCHE }]}>
                    {bedtimeLabel(bed.last)}
                  </Text>
                </View>
              </View>
              <BedtimeChart bars={bed.bars} average={bed.average} />
            </Animated.View>
          ) : null}

          {/* ── Últimas 7 noches ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tus últimas 7 noches</Text>
            <View style={styles.bars}>
              {bars.map((b) => (
                <View key={b.day} style={styles.barCol}>
                  <Text style={[styles.barValue, b.selected && styles.barValueOn]}>
                    {b.minutes != null ? barLabel(b.minutes) : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    {b.minutes != null ? (
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(6, (b.minutes / barScale) * BAR_MAX) },
                          b.selected && styles.barOn,
                        ]}
                      />
                    ) : (
                      <View style={styles.barEmpty} />
                    )}
                  </View>
                  <Text style={[styles.barDay, b.selected && styles.barDayOn]}>{b.initial}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Lo que importa: sueño ↔ déficit ── */}
          {link ? (
            <Pressable
              onPress={() => router.push('/orbit')}
              accessibilityRole="button"
              accessibilityLabel={`${link.headline} Abrir Descubre.`}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.linkHeadline}>{link.headline}</Text>
              <Text style={styles.linkEvidence}>
                {link.good.deficit} de {link.good.days} tras dormir 7 h o más · {link.short.deficit}{' '}
                de {link.short.days} tras noches más cortas
              </Text>
              <Text style={styles.linkCta}>Descubre ›</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const RING = 128
const RING_SW = 14
const RING_R = (RING - RING_SW) / 2 - 2
const RING_C = 2 * Math.PI * RING_R
const GAP = 6

/* El anillo de la noche: un arco por etapa, en proporción, con un pequeño
 * espacio entre ellas (inspirado en Apple, sin nota). Se dibuja al entrar. */
function StageRing({ stages }: { stages: StageSegment[] | null }) {
  const reduce = useReducedMotion() ?? false
  const t = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) return
    t.value = withDelay(150, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [t, reduce])
  const segs = (stages ?? []).filter((s) => s.minutes > 0)
  const c = RING / 2
  const starts = segs.map((_, i) => segs.slice(0, i).reduce((a, s) => a + s.share, 0))
  return (
    <View style={styles.ring}>
      <Svg width={RING} height={RING}>
        <Circle
          cx={c}
          cy={c}
          r={RING_R}
          stroke={colors.hairline}
          strokeWidth={RING_SW}
          fill="none"
        />
        {segs.map((s, i) => (
          <StageArc
            key={s.key}
            start={starts[i] ?? 0}
            share={s.share}
            color={STAGE_COLOR[s.key]}
            t={t}
          />
        ))}
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <MoonGlyph color={ACCENT} size={22} />
      </View>
    </View>
  )
}

function StageArc({
  start,
  share,
  color,
  t,
}: {
  start: number
  share: number
  color: string
  t: SharedValue<number>
}) {
  const c = RING / 2
  const len = Math.max(0, share * RING_C - GAP)
  const props = useAnimatedProps(() => ({ strokeDasharray: [len * t.value, RING_C] }))
  return (
    <AnimatedCircle
      cx={c}
      cy={c}
      r={RING_R}
      stroke={color}
      strokeWidth={RING_SW}
      strokeLinecap="round"
      fill="none"
      rotation={-90 + start * 360}
      originX={c}
      originY={c}
      animatedProps={props}
    />
  )
}

/* 14 noches: la altura es qué tan tarde te dormiste; la línea, tu promedio.
 * La noche vista en el color del sueño, las demás quietas. */
function BedtimeChart({ bars, average }: { bars: BedtimeBar[]; average: number }) {
  const vals = bars.map((b) => b.minutes).filter((m): m is number => m != null)
  const lo = Math.min(average, ...vals) - 45
  const hi = Math.max(average, ...vals) + 15
  const y = (m: number) => CHART_H - ((m - lo) / (hi - lo)) * CHART_H
  const W = 300
  const step = W / bars.length
  const bw = Math.min(14, step * 0.55)
  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} style={styles.chart}>
      {bars.map((b, i) =>
        b.minutes != null ? (
          <Rect
            key={b.day}
            x={i * step + (step - bw) / 2}
            y={y(b.minutes)}
            width={bw}
            height={CHART_H - y(b.minutes)}
            rx={4}
            fill={b.selected ? NOCHE : colors.bruma}
            opacity={b.selected ? 1 : 0.7}
          />
        ) : null,
      )}
      <Line
        x1={0}
        x2={W}
        y1={y(average)}
        y2={y(average)}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.95}
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  back: { width: 40, alignItems: 'flex-start' },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  hero: {
    marginTop: 8,
    padding: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairline,
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  heroBody: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1 },
  heroValue: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  heroWindow: {
    marginTop: 2,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  legend: { marginTop: 12, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  legendValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  ring: { width: RING, height: RING },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  empty: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
  },
  tiles: { marginTop: 12, flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
    gap: 4,
  },
  tileLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  tileValue: {
    marginTop: 4,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displaySm,
    letterSpacing: -0.5,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  tileCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  card: {
    marginTop: 12,
    padding: 18,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    backgroundColor: colors.bgCard,
  },
  pressed: { opacity: 0.8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardKicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  highlight: {
    marginTop: 10,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.leche,
  },
  compareRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compareRight: { alignItems: 'flex-end' },
  compareLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  compareValue: {
    marginTop: 2,
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.displaySm,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  chart: { marginTop: 14 },
  muted: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  bars: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
    marginBottom: 6,
  },
  barValueOn: { color: colors.leche, fontFamily: typography.uiSemi },
  barTrack: { height: BAR_MAX, justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 5, backgroundColor: colors.bruma },
  barOn: { backgroundColor: NOCHE },
  barEmpty: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.hairline },
  barDay: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  barDayOn: { color: colors.leche, fontFamily: typography.uiSemi },
  linkHeadline: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 22,
    color: colors.leche,
  },
  linkEvidence: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  linkCta: {
    marginTop: 12,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    color: colors.magenta,
  },
})
