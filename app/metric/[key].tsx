import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useCyclePhase } from '@/features/cycle/useCyclePhase'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { BeforeAfterSlider } from '@/features/progress/components/BeforeAfterSlider'
import { CountUp } from '@/features/progress/components/CountUp'
import { HealthCardHeader } from '@/features/progress/components/HealthCardHeader'
import {
  DropGlyph,
  DumbbellGlyph,
  FatGlyph,
  FramesGlyph,
  ListGlyph,
  ScaleGlyph,
} from '@/features/progress/components/HealthGlyphs'
import { WeightChart } from '@/features/progress/components/WeightChart'
import { PROGRESS_COMPARE_WINDOW_DAYS } from '@/features/progress/constants'
import { useGatedCompositionSeries, usePhotoTimeline } from '@/features/progress/hooks'
import {
  SERIES_SOURCE_LABEL,
  checkinSeries,
  compareHistory,
  photoNear,
  proteinAverageComparison,
  sameSourceChange,
  zoneEvolution,
  type SeriesPoint,
} from '@/features/progress/logic'
import { METRIC_CONFIG, type MetricKey } from '@/features/progress/metric-config'
import { requestBodyCompare } from '@/features/progress/pending-compare'
import { SkyBackground } from '@/features/tabs/components'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

/*
 * Detalle de una métrica de composición (dueña 7 oct 2026: "fuertemente
 * inspirado en Fitness y Salud"). El mismo lenguaje que Peso: encabezado con
 * el ícono de su categoría, la última medición con fecha y fuente, el cambio
 * SOLO entre mediciones de la misma fuente (un InBody contra una báscula de
 * Salud no es un cambio), la gráfica, promedio / mínimo / máximo, el contexto
 * propio de la métrica en tarjetas y todos los registros. Sin frases.
 */

type DetailKey = Exclude<MetricKey, 'peso'>
type Period = 'H' | 'Y' | 'ALL'
const PERIODS: { key: Period; label: string; a11y: string; days: number | null }[] = [
  { key: 'H', label: '6M', a11y: '6 meses', days: 182 },
  { key: 'Y', label: 'A', a11y: 'Año', days: 365 },
  { key: 'ALL', label: 'Todo', a11y: 'Todo', days: null },
]
const COMPARABLE: DetailKey[] = ['grasa', 'musculo', 'agua']

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtDay = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const fmtShort = (iso: string): string =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`
const toT = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12).getTime()
}
const fmtNum = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1))

function MetricIcon({ k, color, size }: { k: DetailKey; color: string; size?: number }) {
  if (k === 'musculo') return <DumbbellGlyph size={size ?? 18} color={color} />
  if (k === 'agua') return <DropGlyph size={size ?? 18} color={color} />
  if (k === 'imc') return <ScaleGlyph size={size ?? 18} color={color} />
  return <FatGlyph size={size ?? 18} color={color} />
}

export default function MetricDetailScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ key?: string }>()
  const key = (
    ['grasa', 'musculo', 'agua', 'visceral', 'imc'].includes(String(params.key))
      ? String(params.key)
      : 'grasa'
  ) as DetailKey
  const cfg = METRIC_CONFIG[key]
  const [period, setPeriod] = useState<Period>('ALL')
  const [showAll, setShowAll] = useState(false)

  const { series, isPending, checkins } = useGatedCompositionSeries()
  const photosQ = usePhotoTimeline()
  const cycle = useCyclePhase()

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

  const inRange = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? null
    if (days == null) return serie
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    return serie.filter((p) => toT(p.day) >= since)
  }, [serie, period])

  const last = serie[serie.length - 1]
  const change = sameSourceChange(inRange)
  // % se compara en puntos (dueña: grasa y agua en puntos, nunca "+5 %").
  const changeUnit = cfg.unit === '%' ? 'puntos' : cfg.unit
  // Con mediciones de años distintos, las fechas cortas llevan el año.
  const crossYear =
    inRange.length > 1 &&
    inRange[0]!.day.slice(0, 4) !== inRange[inRange.length - 1]!.day.slice(0, 4)
  const fmtStat = (iso: string) => (crossYear ? fmtDay(iso) : fmtShort(iso))
  const stats = useMemo(() => {
    if (inRange.length === 0) return null
    const avg = inRange.reduce((a, p) => a + p.value, 0) / inRange.length
    const min = inRange.reduce((a, p) => (p.value < a.value ? p : a))
    const max = inRange.reduce((a, p) => (p.value > a.value ? p : a))
    return { avg, min, max }
  }, [inRange])

  // Contexto de músculo: entrenos y proteína, 30 días contra los 30 previos.
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

  const newestFirst = [...serie].reverse()
  const listed = showAll ? newestFirst : newestFirst.slice(0, 10)

  const checkinDays = (checkins.data ?? []).map((c) => c.measured_on)
  const canCompare = checkinDays.length >= 2 && COMPARABLE.includes(key)
  const openCompare = () => {
    const a = checkinDays[checkinDays.length - 2]
    const b = checkinDays[checkinDays.length - 1]
    if (!a || !b) return
    requestBodyCompare({ a, b })
    router.back()
    router.navigate('/progress')
  }

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>{cfg.label}</Text>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {isPending ? (
          <View style={styles.skeleton}>
            {Array.from({ length: 3 }, (_, i) => (
              <View key={i} style={styles.skeletonRow} />
            ))}
          </View>
        ) : !last ? (
          <Text style={styles.empty}>{`Aún no hay mediciones de ${cfg.label.toLowerCase()}.`}</Text>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
              <HealthCardHeader
                icon={<MetricIcon k={key} color={cfg.hue} />}
                title="Última medición"
                color={cfg.hue}
                right={`${last.day.slice(0, 4) === String(new Date().getFullYear()) ? fmtShort(last.day) : fmtDay(last.day)}${last.source ? ` · ${SERIES_SOURCE_LABEL[last.source]}` : ''}`}
              />
              <View style={styles.numbers}>
                <View style={styles.valueRow}>
                  <CountUp
                    value={last.value}
                    decimals={last.value % 1 === 0 ? 0 : 1}
                    style={styles.value}
                  />
                  {cfg.unit ? <Text style={styles.unit}>{cfg.unit}</Text> : null}
                </View>
                {change ? (
                  <View style={styles.changeCol}>
                    <Text style={styles.change}>
                      {`${change.abs > 0 ? '↑' : change.abs < 0 ? '↓' : '='} ${fmtNum(Math.abs(change.abs))}${changeUnit ? ` ${changeUnit}` : ''}`}
                    </Text>
                    <Text
                      style={styles.caption}
                    >{`desde el ${change.fromDay.slice(0, 4) === last.day.slice(0, 4) ? fmtShort(change.fromDay) : fmtDay(change.fromDay)}`}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.periods}>
                {PERIODS.map((p) => {
                  const on = p.key === period
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => setPeriod(p.key)}
                      accessibilityRole="button"
                      accessibilityLabel={p.a11y}
                      accessibilityState={{ selected: on }}
                      style={[styles.periodSeg, on && styles.periodSegOn]}
                    >
                      <Text style={[styles.periodText, on && styles.periodTextOn]}>{p.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              {inRange.length > 0 ? (
                <WeightChart
                  points={inRange.map((p) => ({
                    t: toT(p.day),
                    weight: p.value,
                    source: p.source,
                  }))}
                  unit={cfg.unit}
                  color={cfg.hue}
                  sourceLabel={(s) => SERIES_SOURCE_LABEL[s as 'checkin' | 'wearable'] ?? s}
                />
              ) : (
                <Text style={styles.emptyRange}>Sin mediciones en este periodo.</Text>
              )}

              {stats ? (
                <View style={styles.stats}>
                  <Stat
                    label="Promedio"
                    value={`${fmtNum(stats.avg)}${cfg.unit ? ` ${cfg.unit}` : ''}`}
                    sub={`${inRange.length} ${inRange.length === 1 ? 'medición' : 'mediciones'}`}
                  />
                  <Stat
                    label="Mínimo"
                    value={`${fmtNum(stats.min.value)}${cfg.unit ? ` ${cfg.unit}` : ''}`}
                    sub={fmtStat(stats.min.day)}
                  />
                  <Stat
                    label="Máximo"
                    value={`${fmtNum(stats.max.value)}${cfg.unit ? ` ${cfg.unit}` : ''}`}
                    sub={fmtStat(stats.max.day)}
                  />
                </View>
              ) : null}
              {cfg.explainer ? <Text style={styles.caption}>{cfg.explainer}</Text> : null}
            </Animated.View>

            {key === 'grasa' && zones.length > 0 ? (
              <ContextCard
                delay={80}
                icon={<FatGlyph color={cfg.hue} />}
                title="Por zona"
                color={cfg.hue}
                right="Primera → última"
              >
                {zones.map((z) => (
                  <Row
                    key={z.key}
                    label={z.key === 'arms' ? 'Brazos' : z.key === 'trunk' ? 'Tronco' : 'Piernas'}
                    value={`${z.first.toFixed(1)} → ${z.last.toFixed(1)} %`}
                  />
                ))}
              </ContextCard>
            ) : null}

            {key === 'grasa' && photoPair ? (
              <ContextCard
                delay={140}
                icon={<FramesGlyph color={colors.oroSoft} />}
                title="Tus fotos"
                color={colors.oroSoft}
                right={`${fmtShort(serie[0]!.day)} → ${fmtShort(serie[serie.length - 1]!.day)}`}
              >
                <BeforeAfterSlider
                  beforeUrl={photoPair.a.signed_url!}
                  afterUrl={photoPair.b.signed_url!}
                  leftLabel={fmtDay(serie[0]!.day)}
                  rightLabel={fmtDay(serie[serie.length - 1]!.day)}
                />
              </ContextCard>
            ) : null}

            {key === 'musculo' && muscleCtx && (muscleCtx.workouts || muscleCtx.protein) ? (
              <ContextCard
                delay={80}
                icon={<DumbbellGlyph color={colors.dimension.cuerpo} />}
                title="Entrenos y proteína"
                color={colors.dimension.cuerpo}
                right="30 días vs 30 previos"
              >
                {muscleCtx.workouts ? (
                  <Row
                    label="Entrenos"
                    value={`${muscleCtx.workouts.previous} → ${muscleCtx.workouts.current}`}
                  />
                ) : null}
                {muscleCtx.protein ? (
                  <Row
                    label="Proteína al día"
                    value={`${muscleCtx.protein.previous} → ${muscleCtx.protein.current} g`}
                  />
                ) : null}
              </ContextCard>
            ) : null}

            {key === 'agua' && cycle && (cycle.phase === 'lutea' || cycle.phase === 'menstrual') ? (
              <ContextCard
                delay={80}
                icon={<DropGlyph color={colors.oroSoft} />}
                title="Ciclo"
                color={colors.oroSoft}
                right={`Día ${cycle.day}`}
              >
                <Text style={styles.cardText}>
                  En estos días del ciclo el cuerpo retiene más agua.
                </Text>
              </ContextCard>
            ) : null}

            <View style={styles.listHead}>
              <ListGlyph color={colors.bone} />
              <Text style={styles.listTitle}>Todos los registros</Text>
            </View>
            <View style={styles.list}>
              {listed.map((p, i) => (
                <Animated.View
                  key={`${p.day}-${p.source ?? ''}`}
                  entering={FadeIn.duration(240).delay(Math.min(i, 8) * 40)}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowDate}>{fmtDay(p.day)}</Text>
                    {p.source ? (
                      <Text style={styles.caption}>{SERIES_SOURCE_LABEL[p.source]}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.rowValue}>
                    {`${fmtNum(p.value)}${cfg.unit ? ` ${cfg.unit}` : ''}`}
                  </Text>
                </Animated.View>
              ))}
            </View>
            {newestFirst.length > 10 ? (
              <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button">
                <Text style={styles.more}>
                  {showAll ? 'Ver menos' : `Ver todos (${newestFirst.length})`}
                </Text>
              </Pressable>
            ) : null}

            {canCompare ? (
              <Pressable
                onPress={openCompare}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              >
                <Text style={styles.ctaText}>Comparar en Antes y ahora</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/progress-table')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              >
                <Text style={styles.ctaText}>Ver en la tabla</Text>
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

function ContextCard({
  icon,
  title,
  color,
  right,
  delay,
  children,
}: {
  icon: ReactNode
  title: string
  color: string
  right?: string
  delay: number
  children: ReactNode
}) {
  return (
    <Animated.View entering={FadeIn.duration(320).delay(delay)} style={styles.card}>
      <HealthCardHeader icon={icon} title={title} color={color} right={right} />
      <View style={styles.cardBody}>{children}</View>
    </Animated.View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.ctxRow}>
      <Text style={styles.ctxLabel}>{label}</Text>
      <Text style={styles.ctxValue}>{value}</Text>
    </View>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.caption}>{sub}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  screenTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displaySm,
    color: colors.leche,
  },
  close: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.bone,
  },
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  skeletonRow: { height: 64, borderRadius: 16, backgroundColor: colors.bgCard, opacity: 0.6 },
  empty: {
    paddingHorizontal: 20,
    paddingTop: 40,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 14 },
  cardBody: { gap: 2 },
  cardText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.leche,
  },
  numbers: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  value: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.statHero,
    letterSpacing: -1.5,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: typography.uiBold, fontSize: typography.sizes.bodyLarge, color: colors.bone },
  changeCol: { alignItems: 'flex-end', gap: 1 },
  change: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
  periods: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: 10,
    backgroundColor: colors.bgCard2,
  },
  periodSeg: {
    flex: 1,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSegOn: { backgroundColor: colors.magentaTint2 },
  periodText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  periodTextOn: { fontFamily: typography.uiBold, color: colors.leche },
  emptyRange: {
    paddingVertical: 32,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 12,
  },
  stat: { flex: 1, gap: 2 },
  statLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  statValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.heading,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  ctxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  ctxLabel: { fontFamily: typography.uiMedium, fontSize: typography.sizes.ui, color: colors.bone },
  ctxValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  listHead: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  listTitle: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
  },
  list: { borderRadius: 20, backgroundColor: colors.bgCard, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowText: { gap: 2 },
  rowDate: { fontFamily: typography.uiSemi, fontSize: typography.sizes.ui, color: colors.leche },
  rowValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    color: colors.leche,
    fontVariant: ['tabular-nums'],
  },
  more: {
    textAlign: 'center',
    paddingVertical: 8,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  cta: {
    marginTop: 8,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaTint2,
  },
  ctaText: { fontFamily: typography.uiBold, fontSize: typography.sizes.ui, color: colors.leche },
  pressed: { opacity: 0.75 },
  disclaimer: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
  },
})
