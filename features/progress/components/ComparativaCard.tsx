import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import type { BodyMeasurement } from '@/features/brief/api'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useMeasurements, useRecentSleepLogs, useRecentWorkoutDates } from '../hooks'

/* ─────────────────────── Math helpers ─────────────────────── */

type Snapshot = {
  weightKg: number | null
  waistCm: number | null
  workouts28d: number
  sleepAvg7d: number | null
}

/** Find the measurement closest to `targetMsAgo` ms in the past from now. */
function nearestMeasurement(
  rows: readonly BodyMeasurement[],
  targetMsAgo: number,
): BodyMeasurement | null {
  if (rows.length === 0) return null
  const targetTs = Date.now() - targetMsAgo
  let best: BodyMeasurement | null = null
  let bestDelta = Infinity
  for (const r of rows) {
    const d = Math.abs(new Date(r.measured_at).getTime() - targetTs)
    if (d < bestDelta) {
      bestDelta = d
      best = r
    }
  }
  return best
}

const DAY_MS = 24 * 60 * 60 * 1000

function buildNowSnapshot(
  measurements: readonly BodyMeasurement[],
  workouts: readonly string[],
  sleeps: readonly { date: string; hours: number }[],
): Snapshot {
  const latest = measurements[measurements.length - 1] ?? null
  const since28 = Date.now() - 28 * DAY_MS
  const since7 = Date.now() - 7 * DAY_MS
  const workouts28d = workouts.filter((d) => new Date(d).getTime() >= since28).length
  const recentSleep = sleeps.filter((s) => new Date(s.date).getTime() >= since7)
  const sleepAvg7d =
    recentSleep.length === 0
      ? null
      : recentSleep.reduce((sum, s) => sum + s.hours, 0) / recentSleep.length
  return {
    weightKg: latest?.weight_kg ?? null,
    waistCm: latest?.waist_cm ?? null,
    workouts28d,
    sleepAvg7d,
  }
}

function buildPastSnapshot(
  measurements: readonly BodyMeasurement[],
  workouts: readonly string[],
  sleeps: readonly { date: string; hours: number }[],
): Snapshot {
  const past = nearestMeasurement(measurements, 30 * DAY_MS)
  // Workouts during the 28 days that ENDED 30 days ago.
  const wEnd = Date.now() - 30 * DAY_MS
  const wStart = wEnd - 28 * DAY_MS
  const workoutsPast = workouts.filter((d) => {
    const t = new Date(d).getTime()
    return t >= wStart && t < wEnd
  }).length
  // Sleep during the 7 days that ENDED 30 days ago.
  const sEnd = Date.now() - 30 * DAY_MS
  const sStart = sEnd - 7 * DAY_MS
  const recentSleep = sleeps.filter((s) => {
    const t = new Date(s.date).getTime()
    return t >= sStart && t < sEnd
  })
  const sleepAvgPast =
    recentSleep.length === 0
      ? null
      : recentSleep.reduce((sum, s) => sum + s.hours, 0) / recentSleep.length
  return {
    weightKg: past?.weight_kg ?? null,
    waistCm: past?.waist_cm ?? null,
    workouts28d: workoutsPast,
    sleepAvg7d: sleepAvgPast,
  }
}

/* ─────────────────────── Component ─────────────────────── */

/**
 * Multi-metric "Hace 30 días vs Hoy" card. Surfaces 4 dimensions at
 * once — weight, cintura, entrenos, sueño — so the user reads their
 * change as a multi-axis snapshot, not just a weight number. Each
 * metric is only rendered when there's data for it; missing rows are
 * silently skipped instead of showing "—" placeholders.
 */
export function ComparativaCard() {
  const measurements = useMeasurements(null)
  const workouts = useRecentWorkoutDates(60)
  const sleeps = useRecentSleepLogs(40)

  const { now, past, hasComparison } = useMemo(() => {
    const m = measurements.data ?? []
    const w = workouts.data ?? []
    const s = sleeps.data ?? []
    const nowSnap = buildNowSnapshot(m, w, s)
    const pastSnap = buildPastSnapshot(m, w, s)
    // Show only when there's some past anchor to compare. If the user
    // only opened the app yesterday, the past column would be all
    // dashes — better to render nothing.
    const has =
      pastSnap.weightKg != null ||
      pastSnap.waistCm != null ||
      pastSnap.workouts28d > 0 ||
      pastSnap.sleepAvg7d != null
    return { now: nowSnap, past: pastSnap, hasComparison: has }
  }, [measurements.data, workouts.data, sleeps.data])

  if (!hasComparison) return null

  // Build rows in order, skipping any with no data on either side.
  const rows: { label: string; past: string; now: string; delta: string | null }[] = []
  if (past.weightKg != null && now.weightKg != null) {
    rows.push({
      label: 'Peso',
      past: `${past.weightKg.toFixed(1)} kg`,
      now: `${now.weightKg.toFixed(1)} kg`,
      delta: formatDelta(now.weightKg - past.weightKg, 'kg'),
    })
  }
  if (past.waistCm != null && now.waistCm != null) {
    rows.push({
      label: 'Cintura',
      past: `${past.waistCm.toFixed(0)} cm`,
      now: `${now.waistCm.toFixed(0)} cm`,
      delta: formatDelta(now.waistCm - past.waistCm, 'cm'),
    })
  }
  if (past.workouts28d > 0 || now.workouts28d > 0) {
    rows.push({
      label: 'Entrenos (28 d)',
      past: `${past.workouts28d}`,
      now: `${now.workouts28d}`,
      delta: formatCount(now.workouts28d - past.workouts28d),
    })
  }
  if (past.sleepAvg7d != null && now.sleepAvg7d != null) {
    rows.push({
      label: 'Sueño (sem.)',
      past: `${past.sleepAvg7d.toFixed(1)} h`,
      now: `${now.sleepAvg7d.toFixed(1)} h`,
      delta: formatDelta(now.sleepAvg7d - past.sleepAvg7d, 'h'),
    })
  }

  if (rows.length === 0) return null

  return (
    <Animated.View entering={FadeIn.duration(360).delay(280)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Hace 30 días → hoy
      </EyebrowLabel>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerLeft}>ANTES</Text>
          <Text style={styles.headerRight}>HOY</Text>
        </View>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <View style={styles.rowValues}>
              <Text style={styles.rowPast}>{row.past}</Text>
              <Text style={styles.rowArrow}>→</Text>
              <Text style={styles.rowNow}>{row.now}</Text>
              {row.delta ? <Text style={styles.rowDelta}>{row.delta}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

function formatDelta(delta: number, unit: string): string | null {
  if (Math.abs(delta) < 0.05) return null
  const arrow = delta < 0 ? '↘' : '↗'
  const sign = delta < 0 ? '−' : '+'
  return `${arrow} ${sign}${Math.abs(delta).toFixed(1)} ${unit}`
}

function formatCount(delta: number): string | null {
  if (delta === 0) return null
  const arrow = delta < 0 ? '↘' : '↗'
  const sign = delta < 0 ? '−' : '+'
  return `${arrow} ${sign}${Math.abs(delta)}`
}

const styles = StyleSheet.create({
  eyebrow: {
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  headerLeft: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.niebla,
  },
  headerRight: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.magenta,
  },
  row: {
    paddingVertical: 12,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  rowValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowPast: {
    fontFamily: typography.uiMedium,
    fontSize: 15,
    color: colors.bone,
    letterSpacing: -0.1,
  },
  rowArrow: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    color: colors.magenta,
  },
  rowNow: {
    fontFamily: typography.displaySemi,
    fontSize: 17,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  rowDelta: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.magenta,
    marginLeft: 'auto',
  },
})
