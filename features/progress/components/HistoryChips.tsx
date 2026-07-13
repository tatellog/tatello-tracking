import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { PROGRESS_COMPARE_WINDOW_DAYS } from '../constants'
import { useMeasurements } from '../hooks'
import {
  compareHistory,
  historySparklines,
  proteinAverageComparison,
  smoothWeightPoints,
  toWeightPoints,
} from '../logic'
import { Sparkline } from './Sparkline'

/*
 * "Tus últimos 30 días" (F1 · Progress 3.0, mockup dueña) — el 30v30 como GRID
 * DE CHIPS con mini-sparklines, estilo Apple Fitness Trends: auto-comparación
 * contra ti misma, el antídoto del abandono en semana 3 (los hábitos muestran
 * cambio antes que la báscula). UNA sola matemática: todo sale del Comparison
 * Engine puro (compareHistory / historySparklines / proteinAverageComparison).
 *
 * Color = IDENTIDAD por métrica (tokens de dimensión existentes), NUNCA juicio:
 * el mismo hue suba o baje; la dirección la dice ↑/↓ tipográfico. Sin verde/rojo
 * (benchmark + guardarraíl de epic-01). Reemplaza a TuHistoria (convergencia).
 */

type ChipDef = {
  key: string
  label: string
  hue: string
  prev: string
  curr: string
  delta: string | null
  spark: number[] | null
}

const fmtCount = (n: number) => `${n}`
const arrow = (d: number) => (d > 0 ? '↑' : d < 0 ? '↓' : '·')

export function HistoryChips() {
  const windowDays = PROGRESS_COMPARE_WINDOW_DAYS
  const signals = useSignalsHistory(windowDays * 2 + 5)
  const measurements = useMeasurements(null)
  const targets = useMacroTargets().data
  const today = todayInTimezone()

  const chips = useMemo<ChipDef[] | null>(() => {
    if (!signals.data) return null
    const ctx = {
      today,
      calorieTarget: targets?.calories ?? null,
      proteinTarget: targets?.protein_g ?? null,
      windowDays,
    }
    const summary = compareHistory(signals.data, measurements.data ?? [], ctx)
    const sparks = historySparklines(signals.data, ctx)
    const byKey = new Map(summary.metrics.map((m) => [m.key, m]))
    const out: ChipDef[] = []

    const counts: { key: 'workouts' | 'deficit' | 'logging'; label: string; hue: string }[] = [
      { key: 'workouts', label: 'Entrenos', hue: colors.dimension.cuerpo },
      { key: 'logging', label: 'Registro', hue: colors.dimension.alimento },
      { key: 'deficit', label: 'Déficit', hue: colors.magentaHot },
    ]
    for (const c of counts) {
      const m = byKey.get(c.key)
      if (!m) continue
      out.push({
        key: c.key,
        label: c.label,
        hue: c.hue,
        prev: fmtCount(m.previous),
        curr: fmtCount(m.current),
        delta:
          m.delta === 0 ? null : `${arrow(m.delta)} ${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)}`,
        spark: sparks[c.key],
      })
    }

    // Proteína en gramos promedio (el lenguaje del registro del coach).
    const prot = proteinAverageComparison(signals.data, ctx)
    if (prot) {
      const d = prot.current - prot.previous
      out.push({
        key: 'protein',
        label: 'Proteína prom.',
        hue: colors.signal.proteina,
        prev: `${prot.previous} g`,
        curr: `${prot.current} g`,
        delta: d === 0 ? null : `${arrow(d)} ${d > 0 ? '+' : '−'}${Math.abs(d)} g`,
        spark: sparks.protein,
      })
    }

    // Peso: suavizado (media 7d) para que el titular no sea ruido de báscula.
    const w = byKey.get('weight')
    if (w) {
      const smoothTail = smoothWeightPoints(toWeightPoints(measurements.data ?? []))
        .slice(-9)
        .map((p) => p.weight)
      out.push({
        key: 'weight',
        label: 'Peso',
        hue: colors.oroSoft,
        prev: `${w.previous.toFixed(1)}`,
        curr: `${w.current.toFixed(1)} kg`,
        delta:
          w.delta === 0
            ? null
            : `${arrow(w.delta)} ${w.delta > 0 ? '+' : '−'}${Math.abs(w.delta).toFixed(1)} kg`,
        spark: smoothTail.length >= 2 ? smoothTail : null,
      })
    }
    return out
  }, [signals.data, measurements.data, targets?.calories, targets?.protein_g, today, windowDays])

  if (!chips || chips.length === 0) return null

  return (
    <Animated.View entering={FadeIn.duration(360)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Tus últimos 30 días
      </EyebrowLabel>
      <Text style={styles.sub}>vs los 30 anteriores</Text>
      <View style={styles.grid}>
        {chips.map((c) => (
          <View key={c.key} style={styles.chip}>
            <Text style={[styles.chipLabel, { color: c.hue }]}>{c.label}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.prev}>{c.prev}</Text>
              <Text style={[styles.arrow, { color: c.hue }]}>→</Text>
              <Text style={styles.curr}>{c.curr}</Text>
            </View>
            {c.delta ? <Text style={[styles.delta, { color: c.hue }]}>{c.delta}</Text> : null}
            {c.spark ? <Sparkline data={c.spark} hue={c.hue} /> : null}
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  eyebrow: { marginBottom: 2 },
  sub: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.niebla,
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  chipLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.micro,
    letterSpacing: 0.5,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 },
  prev: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  arrow: { fontFamily: typography.uiMedium, fontSize: typography.sizes.body },
  curr: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.headingLg,
    color: colors.leche,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  // Identidad por métrica (mismo hue suba o baje) — dirección solo tipográfica.
  delta: {
    marginTop: 3,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    fontVariant: ['tabular-nums'],
  },
})
