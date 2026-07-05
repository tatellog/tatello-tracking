import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { track } from '@/lib/analytics'
import { useCycleEnabled } from '@/features/cycle/useCycleEnabled'
import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { useProfile } from '@/features/profile/hooks'
import { BeforeAfterPhotos } from '@/features/progress/components/BeforeAfterPhotos'
import { SynthesisCard } from '@/features/progress/components/SynthesisCard'
import { TuHistoria } from '@/features/progress/components/TuHistoria'
import { CycleCard } from '@/features/progress/components/CycleCard'
import { useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  smoothWeightPoints,
  toWeightPoints,
  type Trend,
  type WeightPoint,
} from '@/features/progress/logic'
import { CoachLine, PrimaryCta, SkyBackground, TabHeader } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

// `ALL` (not `TODO`) for the "todo el historial" option — the all-caps
// Spanish word read as a dev-leftover marker in grep + tripped code
// review tools. English keys + Spanish display labels mirrors the
// pattern in RangeChips.tsx.
type Period = '7D' | '30D' | '90D' | 'ALL'

const PERIOD_DAYS: Record<Period, number | null> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  ALL: null,
}

// Display labels — the pills read in plain Spanish.
const PERIOD_LABEL: Record<Period, string> = {
  '7D': '7 días',
  '30D': '30 días',
  '90D': '90 días',
  ALL: 'Todo',
}

// 4-point star — the shared glyph; here it marks the trajectory origin.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)

export default function ProgressScreen() {
  return (
    <ErrorBoundary screen="progreso">
      <ProgressBody />
    </ErrorBoundary>
  )
}

function ProgressBody() {
  useFocusEffect(
    useCallback(() => {
      track('tab_changed', { tab: 'progreso' })
    }, []),
  )
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('30D')
  const measurementsQuery = useMeasurements(PERIOD_DAYS[period])
  const { data: profile } = useProfile()

  const points = useMemo(
    () => toWeightPoints(measurementsQuery.data ?? []),
    [measurementsQuery.data],
  )
  // Weight is shown smoothed — a trailing 7-day moving average — so a
  // single noisy weigh-in never becomes the trend, the delta or the
  // headline number. The raw `points` are kept only for the count.
  const smoothed = useMemo(() => smoothWeightPoints(points), [points])
  const delta = useMemo(() => computeDelta(smoothed), [smoothed])
  const trend = useMemo(() => computeTrend(smoothed), [smoothed])

  const first = smoothed[0]
  const last = smoothed[smoothed.length - 1]
  const count = points.length

  // Cycle phase — used to caption the weight chart so a luteal
  // water-weight bump reads as biology, not regression.
  const cycle = useCyclePhase()
  // Gate de ciclo (sexo/situación): para hombres y perfiles sin ciclo activo
  // NO se muestra la sección — ni la card ni su divisor. CycleCard ya se
  // auto-oculta, pero el divisor quedaba huérfano sin este gate.
  const cycleEnabled = useCycleEnabled()

  // The user's declared focus for the month. When it isn't weight,
  // the "Tu cuerpo" section says so — the number is reference, not a
  // goal they should be chasing.
  const focusIsWeight = profile?.monthly_focus === 'weight'
  const hasFocus = profile?.monthly_focus != null

  const goLogMeasurement = () => router.push('/log-measurement')
  const hasTrajectory = count >= 2

  return (
    <View style={styles.screen}>
      <SkyBackground />

      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(280)}>
            <TabHeader title="Tu progreso" titleEmphasis="Tu" />
          </Animated.View>

          {/* Hero — "Tu Historia": evidencia de transformación (Antes → Ahora)
              en 5 métricas. Responde "¿qué ha cambiado desde que empecé?" antes
              que nada. Reemplaza a Movimiento como primer elemento. */}
          <TuHistoria />

          {/* Síntesis — resultado → causa → qué intentar, la respuesta a
              "¿está funcionando?" en el primer screenful (feedback beta).
              Absorbe la vieja ReadingCard + la línea déficit↔báscula; es el
              ÚNICO link saliente del tab (cuarto, no pasillo). La card del
              emblema se retiró de Progreso: su % junto a la báscula se leía
              como "% de mi meta de peso" (anti-patrón del manifiesto por
              contexto); el emblema vive en Hoy y en Órbita Mes. */}
          <View style={styles.divider} />
          <SynthesisCard />

          {/* "Tu cambio visual" — la evidencia emocional más fuerte: antes →
              ahora en grande, con modo "Comparar" (slider de arrastrar).
              Responde "¿realmente cambio?". */}
          <View style={styles.divider} />
          <BeforeAfterPhotos />

          {/* ── Tu cuerpo — weight + measurements. Demoted out of the
              hero: one section among several, an outcome shown
              calmly. The giant opening delta is gone; the number is
              section-sized now. ── */}
          <View style={styles.divider} />
          <EyebrowLabel tone="magenta" size={10} style={styles.heroEyebrow}>
            Tu cuerpo
          </EyebrowLabel>
          {hasFocus && !focusIsWeight ? (
            <Text style={styles.focusNote}>
              Tu enfoque este mes no es el peso. Esto es solo una referencia, sin metas.
            </Text>
          ) : hasTrajectory ? (
            <Text style={styles.patientSub}>
              El cuerpo cambia despacio. Mira la tendencia, no el número del día.
            </Text>
          ) : null}
          {hasTrajectory ? (
            <>
              <Animated.View entering={FadeIn.duration(360).delay(80)} style={styles.weightHead}>
                {/* Peso ACTUAL — calmo, no gigante: un indicador más, no la
                    meta. El cambio total va como chip, la tendencia en la
                    gráfica. */}
                <View>
                  <Text style={styles.weightLabel}>Peso actual</Text>
                  <View style={styles.weightNowRow}>
                    <Text style={styles.weightNow}>{last?.weight.toFixed(1)}</Text>
                    <Text style={styles.weightUnit}>kg</Text>
                  </View>
                </View>
                {delta ? (
                  <View style={styles.deltaChip}>
                    <Text style={styles.deltaChipLabel}>Cambio total</Text>
                    <Text style={styles.deltaChipNum}>{formatDelta(delta.abs)} kg</Text>
                  </View>
                ) : null}
              </Animated.View>

              {/* Comparación temporal — antes → ahora en el periodo elegido. */}
              {first && last ? (
                <Text style={styles.comparison}>
                  <Text style={styles.compFrom}>{first.weight.toFixed(1)}</Text>
                  <Text style={styles.compArrow}>{'  →  '}</Text>
                  <Text style={styles.compTo}>{last.weight.toFixed(1)} kg</Text>
                  <Text
                    style={styles.compPeriod}
                  >{`   ·   ${PERIOD_LABEL[period].toLowerCase()}`}</Text>
                </Text>
              ) : null}

              {/* Period filter — only meaningful once there are 2+ marks. */}
              <Animated.View entering={FadeIn.duration(320).delay(160)} style={styles.periodPill}>
                {(Object.keys(PERIOD_DAYS) as Period[]).map((p) => {
                  const on = p === period
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPeriod(p)}
                      style={[styles.periodSeg, on && styles.periodSegOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.periodLabel, on && styles.periodLabelOn]}>
                        {PERIOD_LABEL[p]}
                      </Text>
                    </Pressable>
                  )
                })}
              </Animated.View>

              <Animated.View entering={FadeIn.duration(360).delay(240)} style={styles.chartSection}>
                {/* La punteada proyecta desde el ritmo OBSERVADO (nunca desde un
                    plan con fecha): cuando la realidad cambia, la línea cambia
                    sin que nadie "incumpla". */}
                <Text style={styles.chartCaption}>
                  {count} mediciones · media de 7 días
                  {trend ? ' · la punteada sigue tu ritmo real' : ''}
                </Text>
                <TrajectoryChart points={smoothed} trend={trend} />
              </Animated.View>

              {/* Cycle context — weight genuinely shifts with the
                  cycle's water balance; the chart says so, so a
                  luteal bump isn't read as a setback. */}
              {cycle && (cycle.phase === 'lutea' || cycle.phase === 'menstrual') ? (
                <Animated.View entering={FadeIn.duration(360).delay(290)}>
                  <Text style={styles.cycleNote}>
                    {cycle.phase === 'lutea'
                      ? 'La semana antes de tu período el cuerpo retiene agua. Lo que ves en la balanza no es lo que eres.'
                      : 'Estás menstruando: el peso se mueve por agua, no por grasa.'}
                  </Text>
                </Animated.View>
              ) : null}

              {trend ? (
                <Animated.View entering={FadeIn.duration(360).delay(320)}>
                  <CoachLine text={formatTrendCopy(trend)} />
                </Animated.View>
              ) : null}
            </>
          ) : (
            <Animated.View entering={FadeIn.duration(360).delay(80)} style={styles.heroEmpty}>
              {count === 1 && first ? (
                <View style={styles.firstWeightRow}>
                  <Text style={styles.firstWeightNum}>{first.weight.toFixed(1)}</Text>
                  <Text style={styles.firstWeightUnit}>kg</Text>
                </View>
              ) : (
                <Text style={styles.heroEmptyTitle}>
                  Tu primera marca pone una estrella en el cielo.
                </Text>
              )}

              <Text style={styles.heroEmptyHint}>
                {count === 0
                  ? 'Marca tu peso para empezar a trazar tu trayectoria.'
                  : 'Una segunda marca traza tu trayectoria.'}
              </Text>

              <View style={styles.heroCtaWrap}>
                <PrimaryCta
                  label={count === 0 ? 'Marcar mi peso →' : 'Pesarme de nuevo →'}
                  onPress={goLogMeasurement}
                />
              </View>
            </Animated.View>
          )}

          {/* (Comparativa 30 días se reemplazó por el hero "Tu Historia".) */}

          {/* ── Ciclo — solo si el perfil tiene ciclo activo (nunca hombres).
              El divisor se gatea junto a la card para no dejar una línea
              huérfana cuando CycleCard no se renderiza. ── */}
          {cycleEnabled ? (
            <>
              <View style={styles.divider} />
              <CycleCard />
            </>
          ) : null}

          {/* ("Tu cambio visual" se movió arriba, bajo "Tu Historia".) */}

          {/* Bottom CTA — only once the user already has a trajectory;
              the empty / first-weight states carry their own CTA. */}
          {hasTrajectory ? (
            <Animated.View entering={FadeIn.duration(360).delay(400)} style={styles.ctaWrap}>
              <PrimaryCta label="Nueva medición" onPress={goLogMeasurement} />
            </Animated.View>
          ) : null}

          {/* La coda del cuarto — lo único que se rescató de la card del
              emblema (feedback beta: "esa frase me cuida; pero es una frase,
              no una card"). Cierra el tab quitando el miedo a la mala semana. */}
          <Text style={styles.footerCoda}>Tu transformación nunca retrocede.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function formatDelta(kg: number | undefined): string {
  if (kg == null) return '·'
  if (kg === 0) return '0.0'
  const sign = kg < 0 ? '−' : '+'
  return `${sign}${Math.abs(kg).toFixed(1)}`
}

/* ────────────────────────────────────────────────────────────────── */

type ChartProps = {
  points: readonly WeightPoint[]
  trend: Trend | null
}

/*
 * The trajectory. X-axis is REAL TIME — points are placed by their
 * `measured_at` timestamp so the cadence of marks is visible: a 10-day
 * gap and a same-day pair both read truthfully. Same-day measurements
 * are separated by a small temporal nudge (epsilon ms) inside the
 * scale so they don't overlap, but the rest of the line breathes with
 * the actual rhythm.
 *
 * Read as a constellation forming: the measurement stars sit in the
 * sky, the comet line draws itself between them on mount, the current
 * weight blazes as the comet head, and — with enough points for a
 * trend — a dashed line projects the pace forward (capped to a
 * healthy ±1 kg/week so two volatile weeks don't draw a fantasy
 * 8-kg drop in 4 weeks).
 */
function TrajectoryChart({ points, trend }: ChartProps) {
  const W = 300
  const H = 188
  const padX = 18
  const padY = 26

  const lastIdx = points.length - 1
  const last = points[lastIdx]
  const first = points[0]
  const hasProjection = trend != null && last != null

  // Reserve the right slice of the chart for the forward projection.
  const histEndX = hasProjection ? padX + (W - 2 * padX) * 0.64 : W - padX

  // Projection cap — clamp weekly change to ±1 kg/week so two
  // volatile weeks don't extrapolate to an alarming forecast. 1 kg/wk
  // is the upper bound clinicians recommend for sustainable change.
  const PROJECTION_WEEKS = 4
  const MAX_WEEKLY_KG = 1
  const cappedWeekly =
    trend != null ? Math.max(-MAX_WEEKLY_KG, Math.min(MAX_WEEKLY_KG, trend.weeklyChange)) : 0
  const projectedWeight = hasProjection ? last.weight + cappedWeekly * PROJECTION_WEEKS : null

  const ys = points.map((p) => p.weight)
  const domainYs = projectedWeight != null ? [...ys, projectedWeight] : ys
  const minY = Math.min(...domainYs) - 0.7
  const maxY = Math.max(...domainYs) + 0.7

  // Temporal X-scale: map each point's timestamp into the historical
  // band of the chart. Ties (same-day points) are nudged by their
  // ordinal index so they don't collapse to a single column — about
  // 1/12 of a day per duplicate, invisible at chart scale but enough
  // for the line to draw between the dots.
  const tFirst = first?.t ?? 0
  const tLast = last?.t ?? 1
  const tSpan = Math.max(1, tLast - tFirst)
  const TIE_NUDGE_MS = (24 * 60 * 60 * 1000) / 12
  const xByIndex = points.map((p, i) => {
    // Count how many earlier points share this same timestamp; offset
    // by that many nudges so duplicates fan out chronologically.
    let dupes = 0
    for (let j = 0; j < i; j += 1) {
      if (points[j]?.t === p.t) dupes += 1
    }
    const tShifted = p.t + dupes * TIE_NUDGE_MS
    return padX + ((tShifted - tFirst) / tSpan) * (histEndX - padX)
  })
  const sx = (i: number) => xByIndex[i] ?? padX
  const sy = (y: number) => padY + ((maxY - y) / (maxY - minY)) * (H - 2 * padY)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.weight)}`).join(' ')

  // Total polyline length — drives the stroke draw-in.
  let lineLen = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) continue
    lineLen += Math.hypot(sx(i) - sx(i - 1), sy(b.weight) - sy(a.weight))
  }
  lineLen = lineLen || 1

  const draw = useSharedValue(0)
  useEffect(() => {
    draw.value = 0
    draw.value = withDelay(150, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }))
  }, [points, draw])

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLen * (1 - draw.value),
  }))
  const revealProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.62, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const originK = 12 / 24
  const ox = sx(0)
  const oy = sy(first?.weight ?? 0)
  const hx = sx(lastIdx)
  const hy = sy(last?.weight ?? 0)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        {/* Comet gradient — deep magenta tail receding into the bright
            head, so the line itself carries depth. */}
        <SvgGradient id="comet" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.magentaDeep} />
          <Stop offset="1" stopColor={colors.magentaHot} />
        </SvgGradient>
      </Defs>

      {/* Measurement stars — each logged weight, a point of light. */}
      {points.slice(1, lastIdx).map((p, i) => (
        <Circle key={`m${i}`} cx={sx(i + 1)} cy={sy(p.weight)} r={2.6} fill={colors.magenta} />
      ))}

      {/* Origin — a faint star marking where the trajectory began. */}
      <Path
        d={STAR_PATH}
        transform={[
          { translateX: ox - 12 * originK },
          { translateY: oy - 12 * originK },
          { scale: originK },
        ]}
        fill={colors.magentaDeep}
      />

      {/* The trajectory — a comet, drawing itself in on mount. */}
      <AnimatedPath
        d={linePath}
        fill="none"
        stroke="url(#comet)"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={lineLen}
        animatedProps={lineProps}
      />

      {/* Comet head + forward projection — revealed once the line lands. */}
      <AnimatedG animatedProps={revealProps}>
        {hasProjection && projectedWeight != null ? (
          <>
            <Path
              d={`M ${hx} ${hy} L ${W - padX} ${sy(projectedWeight)}`}
              stroke={colors.magentaDeep}
              strokeWidth={1.8}
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
            <Circle
              cx={W - padX}
              cy={sy(projectedWeight)}
              r={4.5}
              fill="none"
              stroke={colors.magentaDeep}
              strokeWidth={1.6}
            />
          </>
        ) : null}
        <Circle cx={hx} cy={hy} r={13} fill={colors.magentaTint2} />
        <Circle cx={hx} cy={hy} r={5.5} fill={colors.magentaHot} />
      </AnimatedG>
    </Svg>
  )
}

const styles = StyleSheet.create({
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
  hero: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  // Empty-state hero — gives the early days (0 / 1 measurement) a
  // shape that doesn't look like a broken chart screen.
  heroEmpty: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  heroEmptyTitle: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: 26,
    lineHeight: 32,
    color: colors.leche,
    letterSpacing: -0.6,
  },
  heroEmptyHint: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.bone,
  },
  // First-weight as hero — same heft as the delta number but no
  // sign, since there's no comparison yet.
  firstWeightRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  // Section-sized, not page-hero-sized — weight is no longer the
  // number the tab opens on.
  firstWeightNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 46,
    paddingTop: 4,
    paddingBottom: 2,
    color: colors.leche,
    letterSpacing: -1,
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  firstWeightUnit: {
    fontFamily: typography.displayMedium,
    fontSize: 21,
    color: colors.magenta,
  },
  heroCtaWrap: {
    marginTop: 22,
  },
  // Thin hairline between the page's three sections (cambio /
  // cambio visual / entreno) so the eye reads them as separate
  // beats instead of an undifferentiated dump.
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 28,
  },
  heroEyebrow: {
    marginBottom: 10,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  // Section-sized — weight is one axis among several now, not the
  // giant delta that used to open the tab.
  deltaNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 46,
    paddingTop: 4,
    paddingBottom: 4,
    color: colors.magenta,
    letterSpacing: -1,
  },
  deltaUnit: {
    fontFamily: typography.displayMedium,
    fontSize: 21,
    color: colors.bone,
  },
  deltaRange: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  deltaStrong: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  // Tono paciente / largo plazo — el peso es un indicador más.
  patientSub: {
    marginTop: 6,
    marginBottom: 4,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  // Cabecera del peso: PESO ACTUAL (calmo) a la izquierda, "cambio total" como
  // chip a la derecha — el número no domina, la tendencia vive en la gráfica.
  weightHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  weightLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 2,
  },
  weightNowRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  weightNow: {
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  weightUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.title,
    color: colors.bone,
  },
  // "Cambio total" — chip callado en oro (sin rojo/verde: el peso no se juzga).
  deltaChip: {
    alignItems: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    backgroundColor: colors.oroTint,
  },
  deltaChipLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  deltaChipNum: {
    marginTop: 1,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  // Comparación temporal — antes → ahora · periodo.
  comparison: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  compFrom: {
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  compArrow: {
    color: colors.oro,
  },
  compTo: {
    fontFamily: typography.uiBold,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  compPeriod: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  // Stadium pill — mirrors the quick-log meal-slot selector.
  periodPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 22,
    padding: 4,
    marginTop: 22,
    marginBottom: 16,
  },
  periodSeg: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegOn: {
    backgroundColor: colors.magentaTint2,
  },
  photoTogglePressed: {
    opacity: 0.6,
  },
  periodLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    // Tight tracking now that the labels are words ("30 días"), not
    // 2–3-char codes — wide tracking would overflow the segment.
    letterSpacing: 0.2,
  },
  periodLabelOn: {
    color: colors.magentaHot,
  },
  // No box — the trajectory floats directly in the page's sky.
  chartSection: {
    marginTop: 4,
  },
  chartCaption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  // Cycle context under the chart — quiet, reassuring, serif italic.
  cycleNote: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  // Coda del tab — serif micro en niebla, mismo registro que las codas de Órbita.
  footerCoda: {
    marginTop: 26,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    textAlign: 'center',
  },
  // Shown in "Tu cuerpo" when the month's focus isn't weight — the
  // section is reference, not a target to chase.
  focusNote: {
    marginTop: -2,
    marginBottom: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  chartEmpty: {
    paddingVertical: 26,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
  },
  ctaWrap: {
    marginTop: 18,
  },
})
