import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { StreakCell } from '@/features/brief/api'
import type { TodayTileState } from '@/features/home/logic'
import { colors, radius, shadows, spacing, typography } from '@/theme'

import { TodayTile } from './TodayTile'

type Props = {
  days: StreakCell[]
  streakCount: number
  contextMessage: string
  todayTileState: TodayTileState
  todayCopy: { topLabel: string; bottomText: string }
  onMarkWorkout: () => void
}

const GRID_ROWS = 4
const GRID_COLS = 7
const CELL_GAP = 4
const CELL_DELAY_MS = 40
const HOLE_DELAY_MS = 60 // stagger for the 4 cells that fill the tile's slot

// Cells in the bottom-right 2×2 (rows 3-4, cols 6-7) — these are
// hidden behind the tile in pending state and reappear with a fast
// stagger when the workout is marked.
const HOLE_INDICES = [19, 20, 26, 27]
const TODAY_INDEX = GRID_ROWS * GRID_COLS - 1
const TILE_ENTRY_DELAY = 24 * CELL_DELAY_MS

/*
 * Hero card. Header (`TU RACHA · 14 DÍAS · 7 SEGUIDOS`), then a
 * full-width 7×4 grid that either shows 28 small cells (workout
 * marked) or 24 small cells + a 2×2 TodayTile in the bottom-right
 * (workout pending). Below: dashed divider, big streak counter,
 * and the prose context line.
 *
 * Cell positions are absolute and computed from a measured grid
 * width — this lets the four "hole" cells (indices 19/20/26/27)
 * disappear and reappear without disturbing the surrounding layout
 * when the user taps Entrené.
 */
export function StreakCard({
  days,
  streakCount,
  contextMessage,
  todayTileState,
  todayCopy,
  onMarkWorkout,
}: Props) {
  const completedCount = days.filter((d) => d.completed).length
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
        <Text style={styles.subLabel}>{`${completedCount} DÍAS · ${streakCount} SEGUIDOS`}</Text>
      </View>

      <StreakGrid
        days={days}
        todayTileState={todayTileState}
        todayCopy={todayCopy}
        onMarkWorkout={onMarkWorkout}
      />

      <View style={styles.dashedDivider} />

      <StreakNumber count={streakCount} />

      <Text style={styles.contextMessage}>{contextMessage}</Text>
    </View>
  )
}

/* ─── grid (absolute-positioned cells + 2×2 tile) ─────────────────── */

type GridProps = {
  days: StreakCell[]
  todayTileState: TodayTileState
  todayCopy: { topLabel: string; bottomText: string }
  onMarkWorkout: () => void
}

function StreakGrid({ days, todayTileState, todayCopy, onMarkWorkout }: GridProps) {
  const [gridWidth, setGridWidth] = useState(0)
  // After the first commit, isInitialMount.current = false. We use
  // this to distinguish 'cells fading in for the first time' (use
  // the chronological cascade) from 'cells filling the hole left by
  // the dismissed tile' (use a tighter 60ms stagger so the grid
  // reseals quickly after a tap).
  const isInitialMount = useRef(true)
  useEffect(() => {
    isInitialMount.current = false
  }, [])

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width
    if (next !== gridWidth) setGridWidth(next)
  }

  const showTile = todayTileState !== 'completed'
  const cellSize = gridWidth ? (gridWidth - (GRID_COLS - 1) * CELL_GAP) / GRID_COLS : 0
  const tileSize = 2 * cellSize + CELL_GAP
  const containerHeight = gridWidth ? GRID_ROWS * cellSize + (GRID_ROWS - 1) * CELL_GAP : 0

  return (
    <View
      style={[styles.gridWrap, gridWidth ? { height: containerHeight } : null]}
      onLayout={onLayout}
    >
      {gridWidth > 0 &&
        days.map((day, i) => {
          if (showTile && HOLE_INDICES.includes(i)) return null

          const isFillingHole = HOLE_INDICES.includes(i) && !isInitialMount.current
          const enterDelay = isFillingHole
            ? HOLE_INDICES.indexOf(i) * HOLE_DELAY_MS
            : i * CELL_DELAY_MS

          const row = Math.floor(i / GRID_COLS)
          const col = i % GRID_COLS

          return (
            <Cell
              key={day.date}
              cell={day}
              index={i}
              top={row * (cellSize + CELL_GAP)}
              left={col * (cellSize + CELL_GAP)}
              size={cellSize}
              enterDelay={enterDelay}
              isToday={i === TODAY_INDEX}
            />
          )
        })}

      {gridWidth > 0 && showTile && (
        <Animated.View
          entering={FadeIn.delay(TILE_ENTRY_DELAY).springify().damping(12)}
          exiting={FadeOut.duration(300)}
          style={{
            position: 'absolute',
            top: 2 * (cellSize + CELL_GAP),
            left: 5 * (cellSize + CELL_GAP),
            width: tileSize,
            height: tileSize,
          }}
        >
          <TodayTile
            state={todayTileState}
            topLabel={todayCopy.topLabel}
            bottomText={todayCopy.bottomText}
            size={tileSize}
            onMark={onMarkWorkout}
          />
        </Animated.View>
      )}
    </View>
  )
}

/* ─── cell (history + today completed) ────────────────────────────── */

type CellProps = {
  cell: StreakCell
  index: number
  top: number
  left: number
  size: number
  enterDelay: number
  isToday: boolean
}

function ageOpacity(index: number): number {
  if (index <= 6) return 0.55
  if (index <= 20) return 0.76
  return 1
}

function Cell({ cell, index, top, left, size, enterDelay, isToday }: CellProps) {
  const enter = FadeIn.delay(enterDelay).springify().damping(12)
  const baseStyle = {
    position: 'absolute' as const,
    top,
    left,
    width: size,
    height: size,
    borderRadius: radius.cell,
  }

  if (!cell.completed) {
    return <Animated.View entering={enter} style={[baseStyle, styles.cellEmpty]} />
  }

  if (isToday) {
    return (
      <Animated.View entering={enter} style={baseStyle}>
        <LinearGradient
          colors={[colors.mauveLight, colors.mauveDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.todayGradient}
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View
      entering={enter}
      style={[baseStyle, styles.cellCompleted, { opacity: ageOpacity(index) }]}
    />
  )
}

/* ─── streak number (count-up animation) ─────────────────────────── */

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)
const COUNT_UP_DURATION = 800

/*
 * Animates count → target with a decelerating curve on the UI
 * thread. Reanimated's `text` animated prop on a TextInput bypasses
 * React re-renders entirely — the number visibly climbs without
 * ticking through state updates.
 *
 * On first mount the displayed value is set directly to `count`
 * (no anim, avoids 'counting from 0 on every cold start'). On
 * subsequent prop changes, it withTimings from the previous value
 * to the new one, so tap-to-mark makes the number crawl up.
 */
function StreakNumber({ count }: { count: number }) {
  const displayed = useSharedValue(count)
  const previous = useRef(count)

  useEffect(() => {
    if (previous.current === count) return
    displayed.value = withTiming(count, {
      duration: COUNT_UP_DURATION,
      easing: Easing.out(Easing.cubic),
    })
    previous.current = count
  }, [count, displayed])

  const rounded = useDerivedValue(() => Math.round(displayed.value))

  const animatedProps = useAnimatedProps(() => {
    const text = String(rounded.value)
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>
  })

  return (
    <View style={styles.numberWrap}>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        animatedProps={animatedProps}
        defaultValue={String(count)}
        accessibilityLabel={`${count} días seguidos`}
        style={styles.bigNumber}
      />
      <Text style={styles.seguidos}>DÍAS SEGUIDOS</Text>
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

  gridWrap: {
    width: '100%',
    position: 'relative',
  },

  cellEmpty: {
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: colors.goldMute,
  },
  cellCompleted: {
    backgroundColor: colors.forestDeep,
  },
  todayGradient: {
    width: '100%',
    height: '100%',
    borderRadius: radius.cell,
  },

  dashedDivider: {
    height: 0,
    borderTopWidth: 0.6,
    borderStyle: 'dashed',
    borderColor: colors.goldAlpha18,
    marginVertical: spacing.md,
  },

  numberWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  bigNumber: {
    fontFamily: typography.display,
    fontSize: typography.sizes.streakNumber,
    color: colors.forestDeep,
    letterSpacing: typography.letterSpacing.display,
    lineHeight: typography.sizes.streakNumber * typography.lineHeight.tight,
    textAlign: 'center',
  },
  seguidos: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
    marginTop: spacing.xs,
  },

  contextMessage: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.prose,
    color: colors.forestDeep,
    lineHeight: typography.sizes.prose * typography.lineHeight.prose,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },
})
