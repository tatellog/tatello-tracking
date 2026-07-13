import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useBodyCheckins, useBodyCompositionIsMock, useWearableComposition } from '../hooks'
import { compositionSeries, type CompositionSeriesKey, type SeriesPoint } from '../logic'
import { Sparkline } from './Sparkline'

/*
 * Composición corporal (F2 · Cuerpo, mockup dueña) — cards POR MÉTRICA con
 * sparkline: la serie completa (check-ins del coach + manual + wearable
 * fusionados en logic.ts/compositionSeries) como forma, y el arco primera →
 * última como números. Solo métricas CON datos (sin cascarones). Delta con el
 * hue de identidad de la métrica, nunca verde/rojo (el cuerpo no se juzga).
 * `muscle_kg` (InBody) y `lean_kg` (HealthKit) son series separadas — honestidad:
 * no son la misma métrica. Evidencia, no veredicto (manifiesto).
 */

const METRICS: { key: CompositionSeriesKey; label: string; unit: string; hue: string }[] = [
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%', hue: colors.signal.proteina },
  { key: 'muscle_kg', label: 'Músculo', unit: 'kg', hue: colors.dimension.cuerpo },
  { key: 'water_pct', label: 'Agua', unit: '%', hue: colors.signal.agua },
  { key: 'bmi', label: 'IMC', unit: '', hue: colors.oroSoft },
  { key: 'lean_kg', label: 'Masa magra', unit: 'kg', hue: colors.dimension.cuerpo },
]

function fmt(v: number, unit: string): string {
  return `${v % 1 === 0 ? v : v.toFixed(1)}${unit ? ` ${unit}` : ''}`
}

export function CompositionCards() {
  const checkins = useBodyCheckins()
  const wearable = useWearableComposition(null)
  const isMock = useBodyCompositionIsMock()

  // Honestidad: con check-ins REALES, el mock del wearable NO se mezcla en las
  // series (diría "de tus mediciones" con puntos inventados adentro). El mock
  // solo llena el vacío cuando no hay ninguna medición propia.
  const hasCheckins = (checkins.data?.length ?? 0) > 0
  const wearableRows = isMock && hasCheckins ? [] : (wearable.data ?? [])
  const series = useMemo(
    () => compositionSeries(checkins.data ?? [], wearableRows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkins.data, wearable.data, isMock],
  )

  const cards = METRICS.map((m) => ({ ...m, serie: series[m.key] })).filter(
    (c) => c.serie.length > 0,
  )
  if (cards.length === 0) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(120)}>
      {/* Divisor propio: solo existe cuando la sección tiene datos. */}
      <View style={styles.divider} />
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Composición corporal
      </EyebrowLabel>
      <View style={styles.grid}>
        {cards.map((c) => (
          <MetricCard key={c.key} label={c.label} unit={c.unit} hue={c.hue} serie={c.serie} />
        ))}
      </View>
      <Text style={styles.note}>
        {isMock && !hasCheckins
          ? 'Datos de ejemplo · así se verá cuando conectes tu báscula o salud.'
          : 'De tus mediciones y salud conectada. Evidencia, no veredicto.'}
      </Text>
    </Animated.View>
  )
}

function MetricCard({
  label,
  unit,
  hue,
  serie,
}: {
  label: string
  unit: string
  hue: string
  serie: SeriesPoint[]
}) {
  const first = serie[0]!
  const last = serie[serie.length - 1]!
  const delta = serie.length > 1 ? Number((last.value - first.value).toFixed(1)) : null
  const arrow = delta == null || delta === 0 ? null : delta > 0 ? '↑' : '↓'
  return (
    <View style={styles.card}>
      <Text style={[styles.cardLabel, { color: hue }]}>{label}</Text>
      <View style={styles.valueRow}>
        {serie.length > 1 ? <Text style={styles.prev}>{fmt(first.value, unit)}</Text> : null}
        {serie.length > 1 ? <Text style={[styles.arrowGlyph, { color: hue }]}>→</Text> : null}
        <Text style={styles.curr}>{fmt(last.value, unit)}</Text>
      </View>
      {delta != null && delta !== 0 ? (
        <Text style={[styles.delta, { color: hue }]}>
          {arrow} {delta > 0 ? '+' : '−'}
          {fmt(Math.abs(delta), unit)}
        </Text>
      ) : (
        <Text style={styles.deltaMuted}>
          {serie.length === 1 ? 'primera medición' : 'sin cambio'}
        </Text>
      )}
      <Sparkline data={serie.map((p) => p.value)} hue={hue} />
    </View>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginVertical: 28 },
  eyebrow: { marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  cardLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  prev: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrowGlyph: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body },
  curr: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  // Identidad por métrica: mismo hue suba o baje. Dirección solo tipográfica.
  delta: {
    marginTop: 3,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    fontVariant: ['tabular-nums'],
  },
  deltaMuted: {
    marginTop: 3,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  note: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
