import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { BeforeAfterSlider } from '@/features/progress/components/BeforeAfterSlider'
import { MetricChart } from '@/features/progress/components/MetricChart'
import { PROGRESS_COMPARE_WINDOW_DAYS } from '@/features/progress/constants'
import { useGatedCompositionSeries, usePhotoTimeline } from '@/features/progress/hooks'
import {
  checkinSeries,
  compareHistory,
  compareSynthesis,
  photoNear,
  proteinAverageComparison,
  zoneEvolution,
  type CheckinDeltaKey,
  type SeriesPoint,
} from '@/features/progress/logic'
import { METRIC_CONFIG, type MetricKey } from '@/features/progress/metric-config'
import { SkyBackground } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Detalle por métrica (Epic 08 · F1) — UNA pantalla parametrizada para
 * grasa/músculo/agua/visceral/IMC (el peso tiene la suya: /weight-trend).
 * Estructura: hero (valor de hoy) → gráfica → historial → contexto propio de
 * la métrica → interpretación del motor como reflexión (sin ✦, sin promesas).
 *
 * Variantes: grasa trae zonas + fotos de sus extremos; músculo trae entrenos
 * y proteína (sus palancas); agua trae el ciclo; visceral e IMC solo contexto
 * COTIDIANO (jamás rangos/"zonas sanas": línea roja del manifiesto; el IMC
 * además no es protagonista — su CTA es la tabla, no un comparador).
 */

type DetailKey = Exclude<MetricKey, 'peso'>
const SYNTH_KEY: Partial<Record<DetailKey, CheckinDeltaKey>> = {
  grasa: 'body_fat_pct',
  musculo: 'muscle_kg',
  agua: 'water_pct',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const fmtVal = (v: number, unit: string) =>
  `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`

export default function MetricDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ key?: string }>()
  const key = (
    ['grasa', 'musculo', 'agua', 'visceral', 'imc'].includes(String(params.key))
      ? String(params.key)
      : 'grasa'
  ) as DetailKey
  const cfg = METRIC_CONFIG[key]

  const { series, isPending, checkins } = useGatedCompositionSeries()
  const photosQ = usePhotoTimeline()
  const cycle = useCyclePhase()

  // Contexto de músculo: entrenos 30v30 + proteína promedio (sus palancas).
  const signals = useSignalsHistory(key === 'musculo' ? PROGRESS_COMPARE_WINDOW_DAYS * 2 + 5 : 0)
  const targets = useMacroTargets().data
  const muscleCtx = useMemo(() => {
    if (key !== 'musculo' || !signals.data) return null
    const ctx = {
      today: todayInTimezone(),
      calorieTarget: targets?.calories ?? null,
      proteinTarget: targets?.protein_g ?? null,
      windowDays: PROGRESS_COMPARE_WINDOW_DAYS,
    }
    const workouts = compareHistory(signals.data, [], ctx).metrics.find((m) => m.key === 'workouts')
    const protein = proteinAverageComparison(signals.data, ctx)
    return { workouts, protein }
  }, [key, signals.data, targets?.calories, targets?.protein_g])

  const serie: SeriesPoint[] = useMemo(() => {
    switch (key) {
      case 'grasa':
        return series.body_fat_pct
      case 'musculo':
        return series.muscle_kg
      case 'agua':
        return series.water_pct
      case 'visceral':
        return checkinSeries(checkins.data ?? [], 'visceral_fat_index')
      case 'imc':
        return checkinSeries(checkins.data ?? [], 'bmi')
    }
  }, [key, series, checkins.data])

  // Zonas + fotos: solo para grasa.
  const zones = useMemo(
    () => (key === 'grasa' ? zoneEvolution(checkins.data ?? []).zones : []),
    [key, checkins.data],
  )
  const photoPair = useMemo(() => {
    if (key !== 'grasa' || serie.length < 2) return null
    const photos = photosQ.data ?? []
    const a = photoNear(photos, 'front', serie[0]!.day)
    const b = photoNear(photos, 'front', serie[serie.length - 1]!.day)
    return a?.signed_url && b?.signed_url && a.id !== b.id ? { a, b } : null
  }, [key, serie, photosQ.data])

  const first = serie[0]
  const last = serie[serie.length - 1]
  const delta =
    first && last && serie.length > 1 ? Number((last.value - first.value).toFixed(1)) : null

  // La reflexión del motor (misma voz honesta del comparador) para las
  // métricas con dirección; visceral/IMC solo llevan su explainer.
  const synthesis = useMemo(() => {
    const synthKey = SYNTH_KEY[key]
    if (!synthKey || !first || !last || delta == null || delta === 0) return null
    return compareSynthesis([{ key: synthKey, a: first.value, b: last.value, delta }], {
      rescueCloser: false,
    })
  }, [key, first, last, delta])

  const historial = useMemo(() => [...serie].reverse().slice(0, 8), [serie])

  // CTA: comparar mediciones (grasa/músculo/agua); visceral/IMC → la tabla
  // (sin protagonismo).
  const checkinDays = (checkins.data ?? []).map((c) => c.measured_on)
  const canCompare = checkinDays.length >= 2 && SYNTH_KEY[key] != null
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
            <Text style={styles.title}>{cfg.label}</Text>
            <Text style={styles.sub}>{cfg.question}</Text>
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
        ) : !last ? (
          <Text style={styles.empty}>Aún no hay mediciones de {cfg.label.toLowerCase()}.</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero: el valor de hoy (fechado), con su variación total. */}
            <Animated.View entering={FadeInDown.duration(420)}>
              <Text style={styles.heroDate}>Última medición · {fmtDay(last.day)}</Text>
              <View style={styles.heroRow}>
                <Text style={[styles.heroNum, key === 'imc' && styles.heroNumQuiet]}>
                  {last.value % 1 === 0 ? last.value : last.value.toFixed(1)}
                </Text>
                {cfg.unit ? <Text style={styles.heroUnit}>{cfg.unit}</Text> : null}
              </View>
              {delta != null && delta !== 0 && first ? (
                <Text style={[styles.heroDelta, { color: cfg.hue }]}>
                  {fmtVal(first.value, cfg.unit)} → {fmtVal(last.value, cfg.unit)} ·{' '}
                  {delta > 0 ? '+' : '−'}
                  {fmtVal(Math.abs(delta), cfg.unit)}
                </Text>
              ) : null}
            </Animated.View>

            {/* La gráfica. */}
            {serie.length >= 2 ? (
              <Animated.View entering={FadeIn.duration(420).delay(120)} style={styles.chartWrap}>
                <MetricChart serie={serie} hue={cfg.hue} height={190} />
              </Animated.View>
            ) : null}

            {/* Contexto propio de la métrica. */}
            {key === 'grasa' && zones.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Por zona</Text>
                {zones.map((z) => (
                  <View key={z.key} style={styles.row}>
                    <Text style={styles.rowLabel}>
                      {z.key === 'arms' ? 'Brazos' : z.key === 'trunk' ? 'Tronco' : 'Piernas'}
                    </Text>
                    <Text style={styles.rowValue}>
                      {z.first.toFixed(1)} % → {z.last.toFixed(1)} %
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {key === 'grasa' && photoPair ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Tus fotos en esas fechas</Text>
                <BeforeAfterSlider
                  beforeUrl={photoPair.a.signed_url!}
                  afterUrl={photoPair.b.signed_url!}
                  leftLabel={fmtDay(serie[0]!.day)}
                  rightLabel={fmtDay(serie[serie.length - 1]!.day)}
                />
              </View>
            ) : null}

            {key === 'musculo' && muscleCtx ? (
              <View style={styles.block}>
                {/* Label factual, sin framing de "palancas hacia construir"
                    (manifesto-review: descriptivo, no coach de recomposición). */}
                <Text style={styles.blockTitle}>Entrenos y proteína · últimos 30 días</Text>
                {muscleCtx.workouts ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Entrenos</Text>
                    <Text style={styles.rowValue}>
                      antes {muscleCtx.workouts.previous} · ahora {muscleCtx.workouts.current}
                    </Text>
                  </View>
                ) : null}
                {muscleCtx.protein ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Proteína al día</Text>
                    <Text style={styles.rowValue}>
                      antes {muscleCtx.protein.previous} g · ahora {muscleCtx.protein.current} g
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {key === 'agua' && cycle && (cycle.phase === 'lutea' || cycle.phase === 'menstrual') ? (
              <Text style={styles.cycleNote}>
                Estás en días en que el cuerpo retiene agua por el ciclo. Que suba no significa que
                algo esté mal.
              </Text>
            ) : null}

            {/* Historial: hechos fechados. */}
            {historial.length > 1 ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Historial</Text>
                {historial.map((p) => (
                  <View key={p.day} style={styles.row}>
                    <Text style={styles.rowLabel}>{fmtDay(p.day)}</Text>
                    <Text style={styles.rowValue}>{fmtVal(p.value, cfg.unit)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* La reflexión (motor, sin ✦) o el contexto cotidiano. */}
            {synthesis ? <Text style={styles.reflection}>{synthesis}</Text> : null}
            {cfg.explainer ? <Text style={styles.explainer}>{cfg.explainer}</Text> : null}

            {/* UN CTA por pantalla. Visceral/IMC sin protagonismo: link a la tabla. */}
            {canCompare ? (
              <Pressable
                onPress={openCompare}
                accessibilityRole="button"
                accessibilityLabel="Comparar dos mediciones"
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.ctaText}>Comparar mis mediciones →</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/progress-table')}
                accessibilityRole="link"
                accessibilityLabel="Ver la tabla completa"
                style={({ pressed }) => [styles.tableLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.tableLinkText}>Ver en la tabla completa →</Text>
              </Pressable>
            )}

            <Text style={styles.disclaimer}>
              Stelar solo interpreta tus registros. No sustituye a un profesional de la salud.
            </Text>
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
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  heroDate: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.niebla,
    marginBottom: 4,
    fontVariant: ['tabular-nums'],
  },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.statHero,
    letterSpacing: -1,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  // El IMC no es protagonista ni en su propia pantalla.
  heroNumQuiet: { fontSize: typography.sizes.displayLg, color: colors.bone },
  heroUnit: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.bone,
  },
  heroDelta: {
    marginTop: 6,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    fontVariant: ['tabular-nums'],
  },
  chartWrap: { marginTop: 14 },
  block: { marginTop: 34 },
  blockTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.oroSoft,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    fontVariant: ['tabular-nums'],
  },
  rowValue: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  cycleNote: {
    marginTop: 24,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.niebla,
  },
  reflection: {
    marginTop: 34,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 25,
    color: colors.leche,
  },
  explainer: {
    marginTop: 20,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
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
  tableLink: { marginTop: 32, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  tableLinkText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    letterSpacing: 0.2,
  },
  disclaimer: {
    marginTop: 16,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.micro,
    color: colors.niebla,
    textAlign: 'center',
  },
})
