import * as Haptics from 'expo-haptics'
import { type ElementRef, useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

// weekdayIdx is 0..6 (0=Sun). Wednesday is written "X" — the Spanish
// convention that disambiguates the martes/miércoles "M/M" collision.
const SPANISH_DAY_INITIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const

// 4-point star, viewBox 24×24, centred (12,12). Outer r≈10, inner
// r≈3.2 — same iconography as the Hoy-tab constellation so a marked
// day reads as "another lit star in your figure".
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

const CELL_W = 46
const GAP = 4
const ROW_PAD = 20
// Column pitch: width + gap. A column's content-space centre x is
// `ROW_PAD + index*PITCH + CELL_W/2`.
const PITCH = CELL_W + GAP
const STAR_SIZE = 22
const GLOW_SIZE = 40

// Scroll-driven falloff: a column whose centre sits at or left of
// FADE_IN (relative to the viewport's left edge) is fully dimmed; at
// or right of FADE_OUT it is fully crisp. Only the left edge fades —
// today and the recent days on the right stay sharp, so "the past
// dims as it scrolls away" while the present never loses focus.
const FADE_IN = -16
const FADE_OUT = 92

export type WeekDayCell = {
  /** ISO 'YYYY-MM-DD'. */
  date: string
  trained: boolean
  dayNum: number
  /** 0..6 (0=Sun) — drives the initial letter. */
  weekdayIdx: number
  isToday: boolean
}

type Props = {
  days: readonly WeekDayCell[]
  onToggle: (date: string) => void
  /** Cell index that received a fresh toggle — drives the burst pulse. */
  justMarkedIdx?: number | null
}

/* Soft magenta halo behind a star — rendered for today (always) and
 * for any day inside its just-marked window, so toggling a past day
 * blooms it alive. */
function StarGlow() {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(420)}
      style={styles.glow}
    />
  )
}

/* Per-day star. Three states:
 *   trained          → filled star (cream for past days, magenta today)
 *   today, untrained → magenta outline — "this is the spot to light"
 *   past, untrained  → dim niebla outline — quiet, waiting
 *
 * Trained stars breathe (opacity + slight scale) on a slow loop so a
 * marked day reads as alive, matching the lit stars in the Hoy-tab
 * constellation. Per-index delay desynchronises the row. */
function DayStar({
  trained,
  isToday,
  index,
}: {
  trained: boolean
  isToday: boolean
  index: number
}) {
  const fill = trained ? (isToday ? colors.magenta : colors.leche) : 'none'
  const stroke = trained ? 'none' : isToday ? colors.magenta : colors.niebla

  const breath = useSharedValue(0)
  useEffect(() => {
    if (!trained) {
      breath.value = 0
      return
    }
    breath.value = withDelay(
      (index % 7) * 220,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(breath)
  }, [trained, index, breath])

  const animStyle = useAnimatedStyle(() => {
    if (!trained) return { opacity: 1, transform: [{ scale: 1 }] }
    return {
      opacity: 0.78 + breath.value * 0.22,
      transform: [{ scale: 1 + breath.value * 0.08 }],
    }
  })

  return (
    <Animated.View style={[styles.starGlyph, animStyle]}>
      <Svg width={STAR_SIZE} height={STAR_SIZE} viewBox="0 0 24 24">
        <Path
          d={STAR_PATH}
          fill={fill}
          stroke={stroke}
          strokeWidth={trained ? 0 : 1.6}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  )
}

/* One day column. Its scale + opacity track the live scroll offset:
 * as the column approaches the left edge it eases down to a dimmed,
 * slightly smaller state, then back to full as it scrolls into view. */
function DayColumn({
  day,
  index,
  scrollX,
  justMarked,
  onToggle,
}: {
  day: WeekDayCell
  index: number
  scrollX: SharedValue<number>
  justMarked: boolean
  onToggle: (date: string) => void
}) {
  const animStyle = useAnimatedStyle(() => {
    const centreX = ROW_PAD + index * PITCH + CELL_W / 2
    const posInViewport = centreX - scrollX.value
    const t = interpolate(posInViewport, [FADE_IN, FADE_OUT], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: 0.32 + t * 0.68,
      transform: [{ scale: 0.85 + t * 0.15 }],
    }
  })

  const glow = day.isToday || justMarked

  return (
    <Animated.View style={[styles.colBox, animStyle]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {})
          onToggle(day.date)
        }}
        style={({ pressed }) => [styles.col, pressed && styles.colPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${day.date}, ${day.trained ? 'entrenado' : 'no entrenado'}`}
        accessibilityHint={day.trained ? 'Toca para desmarcar' : 'Toca para registrar'}
        accessibilityState={{ selected: day.trained }}
      >
        <Text
          style={[
            styles.dayLetter,
            day.trained && styles.dayLetterTrained,
            day.isToday && styles.dayLetterToday,
          ]}
        >
          {day.isToday ? 'HOY' : (SPANISH_DAY_INITIAL[day.weekdayIdx] ?? '?')}
        </Text>
        <Text
          style={[
            styles.dayNum,
            day.trained && styles.dayNumTrained,
            day.isToday && styles.dayNumToday,
          ]}
        >
          {day.dayNum}
        </Text>
        <View style={styles.starWrap}>
          {glow ? <StarGlow /> : null}
          <DayStar trained={day.trained} isToday={day.isToday} index={index} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

/**
 * A horizontally scrollable strip of the last 28 days — the editable
 * history surface. Each day is a bare column (weekday letter, number,
 * star) with no card chrome, so the strip reads in the same airy,
 * editorial language as the constellation above it. Today is the
 * rightmost column — labelled "HOY", drawn in magenta, haloed — and
 * the strip opens scrolled to it; the user swipes left for older
 * days. Columns dim and shrink as they scroll off the left edge.
 * Tapping a column toggles that day to backfill a past workout.
 */
export function WeekStrip({ days, onToggle, justMarkedIdx = null }: Props) {
  const scrollRef = useRef<ElementRef<typeof Animated.ScrollView>>(null)
  const scrollX = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x
  })

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      onScroll={onScroll}
      scrollEventThrottle={16}
      // Content lays out oldest-first; opening at the end puts today
      // under the user's thumb. Fires once on mount (size 0 → full).
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
    >
      {days.map((d, i) => (
        <DayColumn
          key={d.date}
          day={d}
          index={i}
          scrollX={scrollX}
          justMarked={justMarkedIdx === i}
          onToggle={onToggle}
        />
      ))}
    </Animated.ScrollView>
  )
}

const styles = StyleSheet.create({
  // Negative margin cancels the screen's 20px padding so the strip
  // scrolls edge-to-edge; the contentContainer puts that 20px back as
  // padding, so the first/last columns align to the screen gutter.
  scroll: {
    marginHorizontal: -ROW_PAD,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    paddingHorizontal: ROW_PAD,
    paddingVertical: 10,
  },
  colBox: {
    width: CELL_W,
  },
  // No card, no border — each day is just letter / number / star in
  // an airy column, the same visual language as the constellation.
  col: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 6,
  },
  colPressed: {
    opacity: 0.55,
  },
  dayLetter: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  dayLetterTrained: {
    color: colors.bone,
  },
  dayLetterToday: {
    color: colors.magenta,
  },
  dayNum: {
    marginTop: 3,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.anchor,
    color: colors.niebla,
    letterSpacing: -0.6,
    lineHeight: 20,
  },
  dayNumTrained: {
    color: colors.leche,
  },
  dayNumToday: {
    color: colors.leche,
  },
  // Square box sized to the star; `position: relative` makes it the
  // containing block for the absolutely-placed glow.
  starWrap: {
    marginTop: 10,
    width: STAR_SIZE,
    height: STAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  starGlyph: {
    zIndex: 1,
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    top: (STAR_SIZE - GLOW_SIZE) / 2,
    left: (STAR_SIZE - GLOW_SIZE) / 2,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: colors.magentaTint2,
    zIndex: 0,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 9,
    elevation: 3,
  },
})
