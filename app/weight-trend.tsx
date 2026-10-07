import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CountUp } from '@/features/progress/components/CountUp'
import { HealthCardHeader } from '@/features/progress/components/HealthCardHeader'
import { ListGlyph, ScaleGlyph } from '@/features/progress/components/HealthGlyphs'
import { WEIGHT_PERIODS, type WeightPeriod } from '@/features/progress/components/WeightCard'
import { WeightChart, fmtShortDay } from '@/features/progress/components/WeightChart'
import { useBodyCheckins, useMeasurements } from '@/features/progress/hooks'
import {
  WEIGHT_SOURCE_LABEL,
  describeWeightChange,
  mergeWeightSeries,
} from '@/features/progress/logic'
import { SkyBackground } from '@/features/tabs/components'
import { useWearableWeights } from '@/features/wearables/hooks'
import { colors, typography } from '@/theme'

/*
 * Peso · todos los datos (dueña 7 oct 2026, modelo "Mostrar todos los datos"
 * de Salud). La tarjeta de Peso en grande: tu último peso real con fecha y
 * fuente, la gráfica de tus mediciones, el promedio / mínimo / máximo del
 * periodo (cada uno rotulado) y la lista completa de registros. Sin
 * proyecciones, sin "momentos" narrados, sin frases.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fmtFull = (t: number): string => {
  const d = new Date(t)
  return `${d.getDate()} ${MESES[d.getMonth()] ?? ''} ${d.getFullYear()}`
}
const LIST_PREVIEW = 12

export default function WeightTrendScreen() {
  const router = useRouter()
  const measurements = useMeasurements(null)
  const checkins = useBodyCheckins()
  const scale = useWearableWeights()
  const [period, setPeriod] = useState<WeightPeriod>('M')
  const [showAll, setShowAll] = useState(false)

  const all = useMemo(
    () => mergeWeightSeries(measurements.data ?? [], checkins.data ?? [], scale.data ?? []),
    [measurements.data, checkins.data, scale.data],
  )
  const points = useMemo(() => {
    const days = WEIGHT_PERIODS.find((p) => p.key === period)?.days ?? 30
    const since = Date.now() - days * 24 * 60 * 60 * 1000
    return all.filter((p) => p.t >= since)
  }, [all, period])

  const latest = all[all.length - 1] ?? null
  const change = describeWeightChange(points)
  const stats = useMemo(() => {
    if (points.length === 0) return null
    const avg = points.reduce((a, p) => a + p.weight, 0) / points.length
    const min = points.reduce((a, p) => (p.weight < a.weight ? p : a))
    const max = points.reduce((a, p) => (p.weight > a.weight ? p : a))
    return { avg, min, max }
  }, [points])
  const newestFirst = [...all].reverse()
  const listed = showAll ? newestFirst : newestFirst.slice(0, LIST_PREVIEW)

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>Peso</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={12}
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {latest == null ? (
            <Text style={styles.empty}>Aún no hay registros de peso.</Text>
          ) : (
            <>
              <Animated.View entering={FadeIn.duration(320)} style={styles.card}>
                <HealthCardHeader
                  icon={<ScaleGlyph color={colors.magenta} />}
                  title="Último registro"
                  color={colors.magenta}
                  right={`${fmtShortDay(latest.t)}${latest.source ? ` · ${WEIGHT_SOURCE_LABEL[latest.source]}` : ''}`}
                />
                <View style={styles.numbers}>
                  <View style={styles.valueRow}>
                    <CountUp value={latest.weight} decimals={1} style={styles.value} />
                    <Text style={styles.unit}>kg</Text>
                  </View>
                  {change ? (
                    <View style={styles.changeCol}>
                      <Text style={styles.change}>
                        {`${change.abs > 0 ? '↑' : change.abs < 0 ? '↓' : '='} ${Math.abs(change.abs).toFixed(1)} kg`}
                      </Text>
                      <Text style={styles.caption}>{`desde el ${fmtShortDay(change.fromT)}`}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.periods}>
                  {WEIGHT_PERIODS.map((p) => {
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
                        <Text style={[styles.periodText, on && styles.periodTextOn]}>
                          {p.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>

                {points.length > 0 ? (
                  <WeightChart points={points} />
                ) : (
                  <Text style={styles.empty}>Sin registros en este periodo.</Text>
                )}

                {stats ? (
                  <View style={styles.stats}>
                    <Stat label="Promedio" value={stats.avg} sub={`${points.length} registros`} />
                    <Stat label="Mínimo" value={stats.min.weight} sub={fmtShortDay(stats.min.t)} />
                    <Stat label="Máximo" value={stats.max.weight} sub={fmtShortDay(stats.max.t)} />
                  </View>
                ) : null}
              </Animated.View>

              <View style={styles.listHead}>
                <ListGlyph color={colors.bone} />
                <Text style={styles.listTitle}>Todos los registros</Text>
              </View>
              <View style={styles.list}>
                {listed.map((p, i) => (
                  <Animated.View
                    key={p.t}
                    entering={FadeIn.duration(240).delay(Math.min(i, 8) * 40)}
                    style={[styles.row, i > 0 && styles.rowDivider]}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowDate}>{fmtFull(p.t)}</Text>
                      {p.source ? (
                        <Text style={styles.caption}>{WEIGHT_SOURCE_LABEL[p.source]}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.rowValue}>{`${p.weight.toFixed(1)} kg`}</Text>
                  </Animated.View>
                ))}
              </View>
              {newestFirst.length > LIST_PREVIEW ? (
                <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button">
                  <Text style={styles.more}>
                    {showAll ? 'Ver menos' : `Ver todos (${newestFirst.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{`${value.toFixed(1)} kg`}</Text>
      <Text style={styles.caption}>{sub}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },
  card: { borderRadius: 20, backgroundColor: colors.bgCard, padding: 16, gap: 14 },
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
  empty: {
    paddingVertical: 32,
    textAlign: 'center',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
