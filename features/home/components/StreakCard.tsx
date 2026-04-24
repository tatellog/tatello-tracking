import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import type { StreakCell } from '@/features/brief/api'
import { colors, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  days: StreakCell[]
  streakCount: number
  contextMessage: string
}

const GRID_ROWS = 4
const GRID_COLS = 7
const TODAY_INDEX = GRID_ROWS * GRID_COLS - 1
const CELL_GAP = 4
const CELL_DELAY_MS = 40

/*
 * The hero card: 'TU RACHA' header, 7×4 heatmap of the last 28
 * days, a vertical gradient divider, the big streak number, and a
 * serif-italic context line underneath.
 *
 * Cells fade in one-by-one on a 40 ms cadence so the grid 'paints'
 * left-to-right, top-to-bottom. Today (the last cell) is rendered
 * copper instead of forest, pulses gently on breath, and pushes a
 * halo out in a 1.8 s loop — the eye lands there without being
 * told to.
 */
export function StreakCard({ days, streakCount, contextMessage }: Props) {
  const summaryLabel = `Tu racha: ${streakCount} días seguidos. ${contextMessage}`

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={summaryLabel}
    >
      <View style={styles.header}>
        <Text style={styles.label}>TU RACHA</Text>
        <Text style={styles.subLabel}>ÚLTIMOS 28 DÍAS</Text>
      </View>

      <View style={styles.body}>
        <StreakGrid days={days} />
        <View style={styles.vDivider} />
        <StreakNumber count={streakCount} />
      </View>

      <View style={styles.hDivider} />

      <Text style={styles.contextMessage}>{contextMessage}</Text>
    </View>
  )
}

/* ─── 7×4 grid ───────────────────────────────────────────────────── */

type GridProps = { days: StreakCell[] }

function StreakGrid({ days }: GridProps) {
  const rows = Array.from({ length: GRID_ROWS }, (_, r) =>
    days.slice(r * GRID_COLS, (r + 1) * GRID_COLS),
  )

  return (
    <View style={styles.gridWrap}>
      {rows.map((row, rIdx) => (
        <View key={`row-${rIdx}`} style={styles.gridRow}>
          {row.map((cell, cIdx) => {
            const index = rIdx * GRID_COLS + cIdx
            return index === TODAY_INDEX ? (
              <TodayCell key={cell.date} index={index} />
            ) : (
              <HistoryCell key={cell.date} cell={cell} index={index} />
            )
          })}
        </View>
      ))}
    </View>
  )
}

/* ─── history cells ──────────────────────────────────────────────── */

type HistoryProps = { cell: StreakCell; index: number }

function ageOpacity(index: number): number {
  if (index <= 6) return 0.55
  if (index <= 20) return 0.76
  return 1
}

function HistoryCell({ cell, index }: HistoryProps) {
  const enter = FadeIn.delay(index * CELL_DELAY_MS)
    .springify()
    .damping(12)

  if (!cell.completed) {
    return <Animated.View entering={enter} style={[styles.cell, styles.cellEmpty]} />
  }

  return (
    <Animated.View
      entering={enter}
      style={[styles.cell, styles.cellCompleted, { opacity: ageOpacity(index) }]}
    />
  )
}

/* ─── today cell (copper + breathing + halo) ─────────────────────── */

function TodayCell({ index }: { index: number }) {
  const breath = useSharedValue(1)
  const haloScale = useSharedValue(1)
  const haloOpacity = useSharedValue(0)

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
    haloScale.value = withRepeat(
      withTiming(2.3, { duration: 1800, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    )
    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 200, easing: Easing.linear }),
        withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) }),
      ),
      -1,
      false,
    )
  }, [breath, haloScale, haloOpacity])

  const cellStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }))
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }))

  return (
    <Animated.View
      entering={FadeIn.delay(index * CELL_DELAY_MS)
        .springify()
        .damping(12)}
      style={styles.todayWrap}
    >
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.cell, styles.cellToday, cellStyle]} />
    </Animated.View>
  )
}

/* ─── streak number ──────────────────────────────────────────────── */

function StreakNumber({ count }: { count: number }) {
  return (
    <View style={styles.numberWrap}>
      <Text style={styles.bigNumber}>{count}</Text>
      <Text style={styles.seguidos}>SEGUIDOS</Text>
    </View>
  )
}

/* ─── styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.creamShelf,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
  },
  subLabel: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldSoft,
  },

  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  gridWrap: {
    flex: 1,
    gap: CELL_GAP,
  },
  gridRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.cell,
  },
  cellEmpty: {
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: colors.goldMute,
  },
  cellCompleted: {
    backgroundColor: colors.forestDeep,
  },

  todayWrap: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.copperVivid,
  },
  cellToday: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: colors.copperVivid,
    ...shadows.copperToday,
  },

  vDivider: {
    width: 0.5,
    alignSelf: 'stretch',
    backgroundColor: colors.goldAlpha18,
    marginVertical: spacing.sm,
  },

  numberWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  bigNumber: {
    fontFamily: typography.display,
    fontSize: typography.sizes.streakNumber,
    color: colors.forestDeep,
    letterSpacing: typography.letterSpacing.display,
    lineHeight: typography.sizes.streakNumber * typography.lineHeight.tight,
  },
  seguidos: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
    marginTop: spacing.xs,
  },

  hDivider: {
    height: 0.5,
    backgroundColor: colors.goldAlpha12,
    marginVertical: spacing.md,
  },
  contextMessage: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.prose,
    color: colors.forestDeep,
    lineHeight: typography.sizes.prose * typography.lineHeight.prose,
    fontStyle: 'italic',
    textAlign: 'left',
  },
})
