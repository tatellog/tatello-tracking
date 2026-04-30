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
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import type { StreakCell } from '@/features/brief/api'
import type { TodayTileState } from '@/features/home/logic'
import { colors, radius, shadows, spacing, typography } from '@/theme'

import { TodayTile } from './TodayTile'

type Props = {
  days: StreakCell[]
  streakCount: number
  todayTileState: TodayTileState
  todayCopy: { topLabel: string; bottomText: string }
  onMarkWorkout: () => void
  /** ISO timestamp del workout de hoy si ya está marcado, sino null. */
  todayWorkoutAt: string | null
  /**
   * The user has never marked a workout. Switches the card to its
   * Día 1 dressing: warm pearl→tinted gradient, mauve labels, "0
   * EMPEZANDO" counter, and a slow horizontal shimmer overlay.
   */
  isFirstDay?: boolean
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
 * Hero card. Header (`TU RACHA · 28 DÍAS · X SEGUIDOS`), then a
 * full-width 7×4 grid that either shows 28 small cells (workout
 * marked) or 24 small cells + a 2×2 TodayTile in the bottom-right
 * (workout pending). Below: dashed divider + inline streak counter
 * (`14 DÍAS SEGUIDOS`).
 *
 * Cell positions are absolute and computed from a measured grid
 * width — this lets the four "hole" cells (indices 19/20/26/27)
 * disappear and reappear without disturbing the surrounding layout
 * when the user taps Entrené.
 */
export function StreakCard({
  days,
  streakCount,
  todayTileState,
  todayCopy,
  onMarkWorkout,
  todayWorkoutAt,
  isFirstDay = false,
}: Props) {
  const summaryLabel = isFirstDay
    ? 'Día 1. Tu racha empieza hoy.'
    : `Tu racha: ${streakCount} días seguidos.`
  const completedTime =
    todayTileState === 'completed' && todayWorkoutAt ? formatTimeEs(todayWorkoutAt) : null

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={summaryLabel}
    >
      {isFirstDay ? (
        <LinearGradient
          colors={[colors.pearlElevated, '#FCF7F9']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius.card }]}
          pointerEvents="none"
        />
      ) : null}

      {isFirstDay ? <FirstDayShimmer /> : null}

      <View style={styles.header}>
        <Text style={[styles.label, isFirstDay && styles.labelMauve]}>TU RACHA</Text>
        <Text style={[styles.subLabel, isFirstDay && styles.subLabelMauve]}>
          {isFirstDay ? 'DÍA 1' : `28 DÍAS · ${streakCount} SEGUIDOS`}
        </Text>
      </View>

      <StreakGrid
        days={days}
        todayTileState={todayTileState}
        todayCopy={todayCopy}
        onMarkWorkout={onMarkWorkout}
      />

      <View style={styles.dashedDivider} />

      <StreakNumber count={isFirstDay ? 0 : streakCount} isFirstDay={isFirstDay} />

      {completedTime && (
        <Text style={styles.sealedNote} accessibilityLabel={`Día sellado a las ${completedTime}`}>
          ✓ HOY SELLADO · {completedTime}
        </Text>
      )}
    </View>
  )
}

/*
 * Slow horizontal shimmer band that crosses the card while the user
 * is on Día 1. translateX -100% → 100% over 3 s, looping forever.
 * pointerEvents none so it never intercepts taps on the tile.
 */
function FirstDayShimmer() {
  const translate = useSharedValue(-1)

  useEffect(() => {
    translate.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    )
  }, [translate])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${translate.value * 100}%` }],
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.shimmer, animStyle]}>
      <LinearGradient
        colors={['transparent', 'rgba(168, 94, 124, 0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  )
}

/* '14:23' en hora local — usamos la hora del cliente porque el ISO
 * timestamp ya está en UTC y `toLocaleTimeString` lo convierte a la zona
 * del dispositivo. */
function formatTimeEs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
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
  // Pearl Mauve cell aging: oldest week dimmest (0.3), middle (0.6),
  // most recent (1.0). The contrast spread is wider than the prior
  // forest treatment so the 'recency' read lands without color help.
  if (index <= 6) return 0.3
  if (index <= 20) return 0.6
  return 1
}

function Cell({ cell, index, top, left, size, enterDelay, isToday }: CellProps) {
  const enter = FadeIn.delay(enterDelay).springify().damping(12)
  const wrapperStyle = {
    position: 'absolute' as const,
    top,
    left,
    width: size,
    height: size,
  }
  const fillStyle = {
    width: '100%' as const,
    height: '100%' as const,
    borderRadius: radius.cell,
  }

  // Reanimated warns when an entering layout animation runs on the
  // same node that sets opacity/transform statically, so we keep the
  // outer Animated.View bare (only layout) and apply visual styles
  // on a plain inner View.
  if (!cell.completed) {
    return (
      <Animated.View entering={enter} style={wrapperStyle}>
        <View style={[fillStyle, styles.cellEmpty]} />
      </Animated.View>
    )
  }

  if (isToday) {
    return (
      <Animated.View entering={enter} style={wrapperStyle}>
        <LinearGradient
          colors={[colors.mauveLight, colors.mauveDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={fillStyle}
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={enter} style={wrapperStyle}>
      <View style={[fillStyle, styles.cellCompleted, { opacity: ageOpacity(index) }]} />
    </Animated.View>
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
function StreakNumber({ count, isFirstDay = false }: { count: number; isFirstDay?: boolean }) {
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
        accessibilityLabel={isFirstDay ? 'Día 1, empezando' : `${count} días seguidos`}
        style={[styles.bigNumber, isFirstDay && styles.bigNumberMauve]}
      />
      <Text style={[styles.seguidos, isFirstDay && styles.seguidosMauve]}>
        {isFirstDay ? 'EMPEZANDO' : `DÍAS\nSEGUIDOS`}
      </Text>
    </View>
  )
}

/* ─── styles ─────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '60%',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
  },
  subLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelDim,
  },
  labelMauve: {
    color: colors.mauveDeep,
  },
  subLabelMauve: {
    color: colors.mauveDeep,
  },

  gridWrap: {
    width: '100%',
    position: 'relative',
  },

  cellEmpty: {
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: colors.borderDashed,
  },
  cellCompleted: {
    backgroundColor: colors.inkPrimary,
  },

  dashedDivider: {
    height: 0,
    borderTopWidth: 0.6,
    borderStyle: 'dashed',
    borderColor: colors.borderDashed,
    marginVertical: spacing.md,
  },

  numberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bigNumber: {
    fontFamily: typography.display,
    fontSize: typography.sizes.streakNum,
    fontWeight: typography.fontWeight.light,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayTight,
    lineHeight: typography.sizes.streakNum * typography.lineHeight.displayTight,
    textAlign: 'center',
  },
  seguidos: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelMuted,
    lineHeight: typography.sizes.tinyLabel * typography.lineHeight.statement,
  },
  bigNumberMauve: {
    color: colors.mauveDeep,
  },
  seguidosMauve: {
    color: colors.mauveDeep,
  },

  sealedNote: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.feedbackSuccess,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
})
