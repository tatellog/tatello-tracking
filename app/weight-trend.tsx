import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { TrajectoryChart } from '@/features/progress/components/TrajectoryChart'
import { useBodyCheckins, useMeasurements } from '@/features/progress/hooks'
import {
  computeDelta,
  computeTrend,
  formatTrendCopy,
  mergeWeightSeries,
  recoveryFact,
  smoothWeightPoints,
} from '@/features/progress/logic'
import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry/four-point-star-path'
import { SkyBackground } from '@/features/tabs/components'
import { colors, typography } from '@/theme'

/*
 * Tendencia del peso (Epic 08 · F1) — la pregunta de esta pantalla:
 * "¿hacia dónde va mi peso?". Hero calmo (peso actual) → la gráfica ENORME
 * como protagonista → los eventos del camino (hechos fechados, no juicios) →
 * la interpretación del motor como reflexión → UN CTA (comparar).
 *
 * Reusa TODO: TrajectoryChart (el del tab, en grande), la serie fusionada
 * suavizada (una sola verdad de peso), recoveryFact para el evento del pico.
 * Cero detección nueva.
 */

type Period = '7D' | '30D' | '90D' | 'ALL'
const PERIOD_DAYS: Record<Period, number | null> = { '7D': 7, '30D': 30, '90D': 90, ALL: null }
const PERIOD_LABEL: Record<Period, string> = {
  '7D': '7 días',
  '30D': '30 días',
  '90D': '90 días',
  ALL: 'Todo',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtT = (t: number): string => {
  const d = new Date(t)
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

export default function WeightTrendScreen() {
  const router = useRouter()
  const measurements = useMeasurements(null)
  const checkins = useBodyCheckins()
  // La pantalla abre en "Todo": su pregunta es el camino completo; el tab ya
  // cubre la ventana corta.
  const [period, setPeriod] = useState<Period>('ALL')

  const fused = useMemo(
    () => mergeWeightSeries(measurements.data ?? [], checkins.data ?? []),
    [measurements.data, checkins.data],
  )
  const points = useMemo(() => {
    const days = PERIOD_DAYS[period]
    if (days == null) return fused
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    return fused.filter((p) => p.t >= since)
  }, [fused, period])
  const smoothed = useMemo(() => smoothWeightPoints(points), [points])
  const trend = useMemo(() => computeTrend(smoothed), [smoothed])
  const delta = useMemo(() => computeDelta(smoothed), [smoothed])

  // Eventos del camino (siempre sobre la serie COMPLETA, hechos fechados):
  // primera marca, el pico (si hubo rebote) y hoy.
  const smoothedAll = useMemo(() => smoothWeightPoints(fused), [fused])
  const events = useMemo(() => {
    const first = smoothedAll[0]
    const last = smoothedAll[smoothedAll.length - 1]
    if (!first || !last) return []
    const recovery = recoveryFact(smoothedAll)
    const out: { key: string; label: string; date: string; value: string; bright?: boolean }[] = [
      {
        key: 'first',
        label: 'Primera marca',
        date: fmtT(first.t),
        value: `${first.weight.toFixed(1)} kg`,
      },
    ]
    if (recovery) {
      const peak = smoothedAll.reduce((a, b) => (b.weight > a.weight ? b : a), first)
      out.push({
        key: 'peak',
        label: 'El pico',
        date: fmtT(peak.t),
        value: `${recovery.peakKg.toFixed(1)} kg`,
      })
    }
    out.push({
      key: 'today',
      label: 'Hoy',
      date: fmtT(last.t),
      value: `${last.weight.toFixed(1)} kg`,
      bright: true,
    })
    return out
  }, [smoothedAll])

  const cycle = useCyclePhase()
  const last = smoothed[smoothed.length - 1]
  const isPending = measurements.isPending || checkins.isPending

  // CTA comparar: solo con ≥2 check-ins (el análisis compara mediciones).
  const checkinDays = (checkins.data ?? []).map((c) => c.measured_on)
  const canCompare = checkinDays.length >= 2
  const openCompare = () => {
    const a = checkinDays[checkinDays.length - 2]
    const b = checkinDays[checkinDays.length - 1]
    if (a && b) router.push({ pathname: '/progress-analysis', params: { a, b } })
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tendencia del peso</Text>
            <Text style={styles.sub}>Hacia dónde va, sin el ruido del día</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M6 6 L18 18 M18 6 L6 18"
                stroke={colors.bone}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        {isPending ? (
          <View style={styles.skeleton}>
            {Array.from({ length: 4 }, (_, i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : smoothed.length < 2 ? (
          <Text style={styles.empty}>
            Todavía no hay suficiente camino recorrido para ver hacia dónde vas.
          </Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero calmo: el peso de hoy + su cambio en el periodo. */}
            <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
              <Text style={styles.heroLabel}>Peso actual</Text>
              <View style={styles.heroRow}>
                <Text style={styles.heroNum}>{last?.weight.toFixed(1)}</Text>
                <Text style={styles.heroUnit}>kg</Text>
              </View>
              {delta ? (
                <Text style={styles.heroDelta}>
                  {delta.abs < 0 ? '−' : delta.abs > 0 ? '+' : ''}
                  {Math.abs(delta.abs).toFixed(1)} kg · {PERIOD_LABEL[period].toLowerCase()}
                </Text>
              ) : null}
            </Animated.View>

            {/* La protagonista: la gráfica, enorme. */}
            <Animated.View entering={FadeIn.duration(420).delay(120)}>
              <TrajectoryChart points={smoothed} trend={trend} height={250} />
              <Text style={styles.chartCaption}>
                {points.length} registros · media de 7 días
                {trend ? ' · la punteada sigue tu ritmo real' : ''}
              </Text>
            </Animated.View>

            {/* Selector de periodo. */}
            <View style={styles.periodPill}>
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
            </View>

            {/* Los eventos del camino: hechos fechados, cada uno una estrella. */}
            <View style={styles.events}>
              <Text style={styles.eventsTitle}>Los momentos de tu camino</Text>
              {events.map((e) => (
                <View key={e.key} style={styles.eventRow}>
                  <Svg width={18} height={18} viewBox="0 0 18 18">
                    <Path
                      d={fourPointStarPath(9, 9, e.bright ? 6 : 4.5)}
                      fill={e.bright ? colors.oroLeche : colors.oroSoft}
                      opacity={e.bright ? 1 : 0.8}
                    />
                  </Svg>
                  <View style={styles.eventMain}>
                    <Text style={styles.eventLabel}>{e.label}</Text>
                    <Text style={styles.eventDate}>{e.date}</Text>
                  </View>
                  <Text style={[styles.eventValue, e.bright && styles.eventValueBright]}>
                    {e.value}
                  </Text>
                </View>
              ))}
            </View>

            {/* La interpretación, como reflexión (motor, sin ✦). */}
            {trend ? <Text style={styles.reflection}>{formatTrendCopy(trend)}</Text> : null}
            {cycle && (cycle.phase === 'lutea' || cycle.phase === 'menstrual') ? (
              <Text style={styles.cycleNote}>
                {cycle.phase === 'lutea'
                  ? 'La semana antes de tu período el cuerpo retiene agua. Lo que ves en la balanza no es lo que eres.'
                  : 'Estás menstruando: el peso se mueve por agua, no por grasa.'}
              </Text>
            ) : null}

            {/* UN CTA: comparar dos mediciones. */}
            {canCompare ? (
              <Pressable
                onPress={openCompare}
                accessibilityRole="button"
                accessibilityLabel="Comparar dos mediciones"
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaText}>Comparar mis mediciones →</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 2,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  skeletonRow: { height: 44, borderRadius: 12, backgroundColor: colors.bgCard, opacity: 0.6 },
  empty: {
    marginTop: 30,
    paddingHorizontal: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    textAlign: 'center',
  },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48 },
  hero: { marginBottom: 10 },
  heroLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 2,
  },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.statHero,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(252, 246, 235, 0.2)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  heroUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.bone,
  },
  heroDelta: {
    marginTop: 4,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.oroLight,
    fontVariant: ['tabular-nums'],
  },
  chartCaption: {
    marginTop: 4,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    letterSpacing: 0.3,
  },
  periodPill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 22,
    padding: 4,
    marginTop: 20,
  },
  periodSeg: {
    flex: 1,
    height: 34,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegOn: { backgroundColor: colors.magentaTint2 },
  periodLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  periodLabelOn: { color: colors.magentaHot },
  // Eventos: hechos fechados con su estrella; "Hoy" brilla.
  events: { marginTop: 36 },
  eventsTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 10,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  eventMain: { flex: 1 },
  eventLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  eventDate: {
    marginTop: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  eventValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  eventValueBright: { fontFamily: typography.uiBold, color: colors.oroLeche },
  // Reflexión del motor: cita con aire, nunca caption.
  reflection: {
    marginTop: 36,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.leche,
  },
  cycleNote: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
  },
  cta: {
    marginTop: 36,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.magentaTint,
    borderWidth: 1.5,
    borderColor: colors.magentaGlow,
  },
  ctaText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.magentaHot,
  },
})
