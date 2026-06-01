import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import type { BodyMeasurement } from '@/features/brief/api'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useMeasurements, useRecentWorkoutDates } from '../hooks'

/* ─────────────────────── Math helpers ─────────────────────── */

type Snapshot = {
  weightKg: number | null
  workouts28d: number
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
): Snapshot {
  const latest = measurements[measurements.length - 1] ?? null
  const since28 = Date.now() - 28 * DAY_MS
  const workouts28d = workouts.filter((d) => new Date(d).getTime() >= since28).length
  return {
    weightKg: latest?.weight_kg ?? null,
    workouts28d,
  }
}

function buildPastSnapshot(
  measurements: readonly BodyMeasurement[],
  workouts: readonly string[],
): Snapshot {
  const past = nearestMeasurement(measurements, 30 * DAY_MS)
  // Workouts during the 28 days that ENDED 30 days ago.
  const wEnd = Date.now() - 30 * DAY_MS
  const wStart = wEnd - 28 * DAY_MS
  const workoutsPast = workouts.filter((d) => {
    const t = new Date(d).getTime()
    return t >= wStart && t < wEnd
  }).length
  return {
    weightKg: past?.weight_kg ?? null,
    workouts28d: workoutsPast,
  }
}

/* ─────────────────────── Component ─────────────────────── */

/**
 * Multi-metric "Hace 30 días vs Hoy" card. Surfaces 2 dimensions —
 * weight + entrenos — so the user reads their change as a snapshot, not
 * just a weight number. (Cintura and sueño were dropped: cintura has no
 * capture UI, and sueño's onboarding value is a single typical-hours
 * baseline, not the nightly series a 30-day comparison needs — it stays
 * context for the Voz, not a comparison row.) A dimension with no data
 * on one or both sides renders as an invitation row that routes to the
 * right logging surface.
 */
export function ComparativaCard() {
  const measurements = useMeasurements(null)
  const workouts = useRecentWorkoutDates(60)

  const { now, past, hasComparison } = useMemo(() => {
    const m = measurements.data ?? []
    const w = workouts.data ?? []
    const nowSnap = buildNowSnapshot(m, w)
    const pastSnap = buildPastSnapshot(m, w)
    // Show only when there's some past anchor to compare. If the user
    // only opened the app yesterday, the past column would be all
    // dashes — better to render nothing.
    const has = pastSnap.weightKg != null || pastSnap.workouts28d > 0
    return { now: nowSnap, past: pastSnap, hasComparison: has }
  }, [measurements.data, workouts.data])

  const router = useRouter()

  if (!hasComparison) return null

  // Build rows in the same fixed order every time — we always render
  // both metrics so the card reads as a "panel" instead of shifting
  // layout based on what's logged. A row with no data on one or both
  // sides becomes an invitation that routes to the correct logging
  // surface.
  type FilledRow = {
    kind: 'filled'
    label: string
    past: string
    now: string
    delta: string | null
    /** Absolute relative change in % — used to pick the row to highlight. */
    relPct: number
  }
  type EmptyRow = {
    kind: 'empty'
    label: string
    cta: string
    onPress: () => void
  }
  const rows: (FilledRow | EmptyRow)[] = []

  // ── Peso ──
  if (past.weightKg != null && now.weightKg != null) {
    const diff = now.weightKg - past.weightKg
    rows.push({
      kind: 'filled',
      label: 'Peso',
      past: `${past.weightKg.toFixed(1)} kg`,
      now: `${now.weightKg.toFixed(1)} kg`,
      delta: formatDelta(diff, 'kg'),
      relPct: relPct(diff, past.weightKg),
    })
  } else {
    rows.push({
      kind: 'empty',
      label: 'Peso',
      cta:
        now.weightKg == null
          ? 'Registra tu peso de hoy'
          : 'Necesitamos otra medición para comparar',
      onPress: () => router.push('/log-measurement'),
    })
  }

  // ── Entrenos (28 d) ──
  if (past.workouts28d > 0 || now.workouts28d > 0) {
    const diff = now.workouts28d - past.workouts28d
    // For counts, "rel %" is meaningless when past=0; use a coarse
    // magnitude scaled to a reasonable baseline (8 entrenos/mes) so a
    // jump from 0→6 still reads as significant.
    const denom = Math.max(past.workouts28d, 8)
    rows.push({
      kind: 'filled',
      label: 'Entrenos (28 d)',
      past: `${past.workouts28d}`,
      now: `${now.workouts28d}`,
      delta: formatCount(diff),
      relPct: (Math.abs(diff) / denom) * 100,
    })
  } else {
    rows.push({
      kind: 'empty',
      label: 'Entrenos (28 d)',
      cta: 'Loguea tu primer entreno desde ✦',
      onPress: () => router.push('/(tabs)'),
    })
  }

  // Pick the row with the largest relative change to highlight.
  // Ignored if no row has a meaningful delta (< 1%) — silence is OK.
  const highlightIndex = (() => {
    let best = -1
    let bestPct = 1 // threshold: at least 1% change to be worth marking
    rows.forEach((r, i) => {
      if (r.kind === 'filled' && r.relPct > bestPct) {
        bestPct = r.relPct
        best = i
      }
    })
    return best
  })()

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
        {rows.map((row, i) => {
          if (row.kind === 'filled') {
            const isHighlight = i === highlightIndex
            return (
              <View
                key={row.label}
                style={[styles.row, i > 0 && styles.rowDivider, isHighlight && styles.rowHighlight]}
              >
                <Text style={[styles.rowLabel, isHighlight && styles.rowLabelHighlight]}>
                  {row.label}
                </Text>
                <View style={styles.rowValues}>
                  <Text style={styles.rowPast}>{row.past}</Text>
                  <Text style={styles.rowArrow}>→</Text>
                  <Text style={[styles.rowNow, isHighlight && styles.rowNowHighlight]}>
                    {row.now}
                  </Text>
                  {row.delta ? (
                    <Text style={[styles.rowDelta, isHighlight && styles.rowDeltaHighlight]}>
                      {row.delta}
                    </Text>
                  ) : null}
                </View>
              </View>
            )
          }
          // Invitation row — same vertical rhythm as filled rows so
          // the card layout stays stable; the body is replaced by a
          // soft CTA the user can tap to start logging.
          return (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowLabelEmpty}>{row.label}</Text>
              <View style={styles.rowValues}>
                <Text style={styles.emptyHint}>{row.cta}</Text>
                <Text style={styles.emptyChevron}>›</Text>
              </View>
            </Pressable>
          )
        })}
      </View>
    </Animated.View>
  )
}

/** Absolute relative change as a positive percentage. */
function relPct(delta: number, base: number): number {
  if (!base) return 0
  return (Math.abs(delta) / Math.abs(base)) * 100
}

// No pictographic arrow: U+2197/2198 render as a color emoji in fonts
// that lack the text glyph (e.g. the displayHeavy highlight face), which
// looked like a stray iOS sticker. The +/− sign already carries the
// direction and is plain text in every font.
function formatDelta(delta: number, unit: string): string | null {
  if (Math.abs(delta) < 0.05) return null
  const sign = delta < 0 ? '−' : '+'
  return `${sign}${Math.abs(delta).toFixed(1)} ${unit}`
}

function formatCount(delta: number): string | null {
  if (delta === 0) return null
  const sign = delta < 0 ? '−' : '+'
  return `${sign}${Math.abs(delta)}`
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
  row: {
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  // Highlight band — applied to the row with the largest relative
  // delta. A faint magenta wash + ribbon on the left edge so the eye
  // finds it without the whole card screaming.
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
  rowLabelHighlight: {
    color: colors.magenta,
  },
  rowLabelEmpty: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.7,
  },
  rowValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowPast: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: -0.1,
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
  },
  rowNowHighlight: {
    color: colors.magenta,
  },
  rowDelta: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.magenta,
    marginLeft: 'auto',
  },
  rowDeltaHighlight: {
    fontFamily: typography.displayHeavy,
    fontStyle: 'normal',
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: -0.2,
  },
  // Invitation row body — quieter than a filled row so empty rows
  // don't compete visually with the actual data.
  emptyHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
    opacity: 0.7,
    flex: 1,
  },
  emptyChevron: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.segmentTitle,
    color: colors.niebla,
    lineHeight: 22,
    marginLeft: 'auto',
  },
})
