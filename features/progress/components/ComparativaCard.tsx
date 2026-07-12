import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useHistory } from '../hooks'
import type { MetricComparison } from '../types'

/*
 * "Hace 30 días → hoy" — el Hero de Historia (Epic 01). Compara los hábitos de
 * las últimas 30 días vs las 30 previas: entrenos, proteína, déficit, registro y
 * peso. Toda la matemática vive en el Comparison Engine puro (`logic.ts`,
 * `compareHistory`); esta card SOLO pinta el `HistorySummary` que le da
 * `useHistory()`. Responde "¿cómo cambiaron mis hábitos?" — QUÉ cambió, sin por
 * qué (eso es Órbita). Sin color de culpa: la dirección se nombra como hecho.
 */

/** Etiqueta + unidad por métrica. Las de conteo son "días"; peso es kg. */
const META: Record<MetricComparison['key'], { label: string; count: boolean }> = {
  workouts: { label: 'Entrenos', count: true },
  protein: { label: 'Proteína en meta', count: true },
  deficit: { label: 'Días en déficit', count: true },
  logging: { label: 'Días con registro', count: true },
  weight: { label: 'Peso', count: false },
}

function fmtValue(m: MetricComparison, v: number): string {
  return m.key === 'weight' ? `${v.toFixed(1)} kg` : `${v}`
}

function fmtDelta(m: MetricComparison): string | null {
  if (m.delta === 0) return null
  const sign = m.delta < 0 ? '−' : '+'
  const abs = Math.abs(m.delta)
  return m.key === 'weight' ? `${sign}${abs.toFixed(1)} kg` : `${sign}${abs}`
}

/** Cambio relativo (para elegir la fila a resaltar). Para conteos, una base
 *  razonable (8/mes) evita que 0→2 domine; para peso, sobre el valor previo. */
function relPct(m: MetricComparison): number {
  const base = m.key === 'weight' ? Math.abs(m.previous) : Math.max(m.previous, 8)
  return base ? (Math.abs(m.delta) / base) * 100 : 0
}

export function ComparativaCard() {
  const state = useHistory()

  // Solo cuando hay algo real que comparar. loading/empty/error → nada (calma).
  if (state.status !== 'completed' && state.status !== 'partial') return null
  const metrics = state.data.metrics
  if (metrics.length === 0) return null

  // Resalta la fila con el mayor cambio relativo (≥1% para valer la marca).
  let highlight = -1
  let bestPct = 1
  metrics.forEach((m, i) => {
    const p = relPct(m)
    if (p > bestPct) {
      bestPct = p
      highlight = i
    }
  })

  return (
    <Animated.View entering={FadeIn.duration(360).delay(120)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Hace 30 días → hoy
      </EyebrowLabel>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerLeft}>ANTES</Text>
          <Text style={styles.headerRight}>HOY</Text>
        </View>
        {metrics.map((m, i) => {
          const isHighlight = i === highlight
          const delta = fmtDelta(m)
          return (
            <View
              key={m.key}
              style={[styles.row, i > 0 && styles.rowDivider, isHighlight && styles.rowHighlight]}
            >
              <Text style={[styles.rowLabel, isHighlight && styles.rowLabelHighlight]}>
                {META[m.key].label}
              </Text>
              <View style={styles.rowValues}>
                <Text style={styles.rowPast}>{fmtValue(m, m.previous)}</Text>
                <Text style={styles.rowArrow}>→</Text>
                <Text style={[styles.rowNow, isHighlight && styles.rowNowHighlight]}>
                  {fmtValue(m, m.current)}
                </Text>
                {delta ? (
                  <Text style={[styles.rowDelta, isHighlight && styles.rowDeltaHighlight]}>
                    {delta}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  eyebrow: { marginBottom: 14 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 },
  headerLeft: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    color: colors.niebla,
  },
  headerRight: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    color: colors.magenta,
  },
  row: { paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rowHighlight: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(214, 60, 130, 0.07)',
    borderLeftWidth: 2,
    borderLeftColor: colors.magenta,
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  rowLabelHighlight: { color: colors.magenta },
  rowValues: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  rowPast: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },
  rowArrow: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.magenta,
  },
  rowNow: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.anchor,
    color: colors.leche,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  rowNowHighlight: { color: colors.magenta },
  rowDelta: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.magenta,
    marginLeft: 'auto',
    fontVariant: ['tabular-nums'],
  },
  rowDeltaHighlight: {
    fontFamily: typography.displayHeavy,
    fontStyle: 'normal',
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: -0.2,
  },
})
