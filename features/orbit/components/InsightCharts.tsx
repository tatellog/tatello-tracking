import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { Chart } from '../findings'

/*
 * Gráficas MÍNIMAS de evidencia para el detalle de un hallazgo. No son
 * dashboards ni widgets: son la respuesta visual a "¿cómo sabe eso?". Mucho
 * aire, una sola idea por gráfica. Estilo editorial, no analítico.
 */

export function InsightChart({ chart, tint }: { chart: Chart; tint: string }) {
  if (chart.kind === 'weekdayBars') return <WeekdayBars chart={chart} tint={tint} />
  return <DotTimeline chart={chart} tint={tint} />
}

function WeekdayBars({
  chart,
  tint,
}: {
  chart: Extract<Chart, { kind: 'weekdayBars' }>
  tint: string
}) {
  const max = Math.max(1, ...chart.bars.map((b) => b.value))
  return (
    <View style={styles.wrap}>
      <View style={styles.barsRow}>
        {chart.bars.map((b, i) => (
          <View key={i} style={styles.barCol}>
            {b.highlight ? <Text style={[styles.barValue, { color: tint }]}>{b.value}</Text> : null}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${(b.value / max) * 100}%`,
                    backgroundColor: b.highlight ? tint : colors.bruma,
                    opacity: b.highlight ? 1 : 0.55,
                  },
                ]}
              />
            </View>
            <Text style={[styles.barLabel, b.highlight && { color: colors.leche }]}>{b.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.unit}>{chart.unit}</Text>
    </View>
  )
}

function DotTimeline({
  chart,
  tint,
}: {
  chart: Extract<Chart, { kind: 'dotTimeline' }>
  tint: string
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.dotRow}>
        {chart.dots.map((d, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              d === 'off' && styles.dotOff,
              d === 'on' && { backgroundColor: tint, opacity: 0.4 },
              d === 'strong' && { backgroundColor: tint, width: 11, height: 11, borderRadius: 5.5 },
            ]}
          />
        ))}
      </View>
      {chart.caption ? <Text style={styles.caption}>{chart.caption}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  // ── Barras por día de semana ──
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 96 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '68%', borderRadius: 5, minHeight: 3 },
  barValue: { fontFamily: typography.uiBold, fontSize: typography.sizes.micro },
  barLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  unit: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.4,
    color: colors.niebla,
    textAlign: 'center',
  },
  // ── Línea de puntos ──
  dotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  dotOff: { backgroundColor: colors.bruma, opacity: 0.45 },
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
})
