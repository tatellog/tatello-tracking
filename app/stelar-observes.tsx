import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { daysInDeficit } from '@/features/orbit/month-built'
import { PROGRESS_COMPARE_WINDOW_DAYS } from '@/features/progress/constants'
import {
  useBodyCheckins,
  useGatedCompositionSeries,
  useMeasurements,
} from '@/features/progress/hooks'
import {
  compareHistory,
  compositionSynthesis,
  computeDelta,
  computeTrend,
  formatTrendCopy,
  mergeWeightSeries,
  proteinAverageComparison,
  recoveryFact,
  smoothWeightPoints,
} from '@/features/progress/logic'
import { SkyBackground } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Lo que Stelar observa (Epic 08 · F2) — la pantalla SIN gráficas: solo
 * interpretación, como un capítulo de libro. Máximo cinco observaciones,
 * cada una fechada en su ventana.
 *
 * TODO sale del MOTOR determinístico ya existente (recoveryFact, plateau,
 * tendencia, síntesis de composición, el delta líder del 30v30): sin ✦ (el
 * sello es exclusivo del chat IA · regla dueña), sin fingir mente, sin
 * promesas de futuro. La observación narra lo que pasó; jamás lo que "viene".
 */

const MESES_LARGO = [
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

type Observation = { key: string; window: string; text: string }

export default function StelarObservesScreen() {
  const router = useRouter()
  const measurements = useMeasurements(null)
  const checkinsQ = useBodyCheckins()
  const { series } = useGatedCompositionSeries()
  const signals = useSignalsHistory(PROGRESS_COMPARE_WINDOW_DAYS * 2 + 5)
  const targets = useMacroTargets().data

  const observations = useMemo<Observation[]>(() => {
    const out: Observation[] = []
    const fused = mergeWeightSeries(measurements.data ?? [], checkinsQ.data ?? [])
    const smoothedAll = smoothWeightPoints(fused)

    // 1 · La recuperación (tu camino): el rebote nombrado y lo recorrido.
    const recovery = recoveryFact(smoothedAll)
    if (recovery) {
      out.push({
        key: 'recovery',
        window: 'Tu camino',
        text: `Subiste hasta ${recovery.peakKg.toFixed(1)} kg. Desde ahí, ya bajaste ${recovery.droppedKg.toFixed(1)}.`,
      })
    }

    // 2 · Báscula quieta + esfuerzo presente (30 días rodantes).
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000
    const smoothed30 = smoothWeightPoints(fused.filter((p) => p.t >= since))
    const delta30 = computeDelta(smoothed30)
    if (delta30 && smoothed30.length >= 3 && Math.abs(delta30.abs) < 0.3) {
      const summary = daysInDeficit(signals.data ?? [], {
        calorieTarget: targets?.calories ?? null,
      })
      if (summary != null && summary.deficitDays >= 3) {
        out.push({
          key: 'plateau',
          window: 'Tus 30 días',
          text: `La báscula casi no se movió estos 30 días. Tus ${summary.deficitDays} días en déficit sí quedaron registrados.`,
        })
      }
    }

    // 3 · La tendencia del peso (voz del coach existente).
    const trend = computeTrend(smoothed30)
    if (trend) {
      out.push({ key: 'trend', window: 'Tus 30 días', text: formatTrendCopy(trend) })
    }

    // 4 · El cambio más claro del mes (el mismo líder del 30v30).
    if (signals.data) {
      const ctx = {
        today: todayInTimezone(),
        calorieTarget: targets?.calories ?? null,
        proteinTarget: targets?.protein_g ?? null,
        windowDays: PROGRESS_COMPARE_WINDOW_DAYS,
      }
      const metrics = compareHistory(signals.data, [], ctx).metrics
      const protein = proteinAverageComparison(signals.data, ctx)
      const candidates: { label: string; prev: number; curr: number; unit: string }[] = []
      for (const m of metrics) {
        if (m.key === 'deficit')
          candidates.push({ label: 'días en déficit', prev: m.previous, curr: m.current, unit: '' })
        if (m.key === 'logging')
          candidates.push({
            label: 'días con registro',
            prev: m.previous,
            curr: m.current,
            unit: '',
          })
        if (m.key === 'workouts')
          candidates.push({ label: 'entrenos', prev: m.previous, curr: m.current, unit: '' })
      }
      if (protein)
        candidates.push({
          label: 'proteína al día',
          prev: protein.previous,
          curr: protein.current,
          unit: ' g',
        })
      // Mismas guardas anti-ruido que el chip líder: mínimo absoluto + piso.
      const best = candidates
        .map((c) => ({
          ...c,
          score:
            Math.abs(c.curr - c.prev) >= (c.unit ? 10 : 3)
              ? Math.abs(c.curr - c.prev) / Math.max(c.prev, c.unit ? 50 : 5)
              : 0,
        }))
        .sort((a, b) => b.score - a.score)[0]
      if (best && best.score > 0) {
        out.push({
          key: 'lead',
          window: 'Tus 30 días',
          text: `Tu cambio más claro del mes: ${best.label}, de ${best.prev}${best.unit} a ${best.curr}${best.unit}.`,
        })
      }
    }

    // 5 · Composición (fechada en su última medición).
    const synth = compositionSynthesis(series)
    const lastCompDay = Object.values(series)
      .flat()
      .reduce<string | null>((acc, p) => (acc == null || p.day > acc ? p.day : acc), null)
    if (synth && lastCompDay) {
      const m = Number(lastCompDay.slice(5, 7))
      const y = lastCompDay.slice(0, 4)
      out.push({
        key: 'composition',
        window: `Tu composición · ${MESES_LARGO[m - 1]} ${y}`,
        text: synth,
      })
    }

    return out.slice(0, 5)
  }, [measurements.data, checkinsQ.data, signals.data, targets, series])

  const isPending = measurements.isPending || checkinsQ.isPending || signals.isLoading

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Lo que Stelar observa</Text>
            <Text style={styles.sub}>Tus datos, leídos con calma</Text>
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
            {Array.from({ length: 3 }, (_, i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : observations.length === 0 ? (
          <Text style={styles.empty}>
            Todavía no hay suficiente registro para una lectura. Tus días la van escribiendo.
          </Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {observations.map((o, i) => (
              <Animated.View
                key={o.key}
                entering={FadeInDown.duration(460).delay(i * 110)}
                style={styles.card}
              >
                <Text style={styles.window}>{o.window}</Text>
                <Text style={styles.text}>{o.text}</Text>
              </Animated.View>
            ))}
            <Text style={styles.footer}>Hecho con tus números. Evidencia, no veredicto.</Text>
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
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  skeletonRow: { height: 96, borderRadius: 18, backgroundColor: colors.bgCard, opacity: 0.6 },
  empty: {
    marginTop: 30,
    paddingHorizontal: 24,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
    textAlign: 'center',
  },
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 48, gap: 18 },
  // Cada observación, una página chica de libro: ventana + texto serif.
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  window: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 8,
  },
  text: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 26,
    color: colors.leche,
  },
  footer: {
    marginTop: 6,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
})
