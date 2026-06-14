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

import type { CalendarDay, DayStatus } from '@/features/tabs/components/calendar/logic'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors, typography } from '@/theme'

// weekdayIdx is 0..6 (0=Sun). Wednesday is written "X" — the Spanish
// convention that disambiguates the martes/miércoles "M/M" collision.
const SPANISH_DAY_INITIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const

// 4-point star, viewBox 24×24, centred (12,12). Outer r≈10, inner
// r≈3.2 — same iconography as the Hoy-tab constellation so a marked
// day reads as "another lit star in your figure".
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
// Crescent moon (Feather "moon"), viewBox 24×24 — a RESTED day. Filled
// faint so rest reads as a quiet, valid choice (never a missed star).
const MOON_PATH = 'M21 12.79 A9 9 0 1 1 11.21 3 A7 7 0 0 0 21 12.79 Z'

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

type Props = {
  days: readonly CalendarDay[]
  /** Currently selected day (drives the ring); null = none. */
  selectedDate: string | null
  /** Tap a day → select it (opens the detail panel). Never toggles. */
  onSelect: (date: string) => void
}

/* Soft magenta halo behind a star — rendered for trained days so a lit
 * day pops against the dim untrained outlines. */
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

/* Per-day glyph. Three states:
 *   trained → filled star (cream for past days, magenta today) — breathes
 *   rested  → faint crescent moon (rest is valid, not a missed star)
 *   empty   → dim outline star (quiet, waiting)
 *
 * Trained stars breathe (opacity + slight scale) on a slow loop so a
 * marked day reads as alive, matching the lit stars in the constellation.
 * GATED on `active`: Hoy stays mounted forever (detachInactiveScreens=
 * false), so ungated loops would tick off-tab + through every scroll. */
function DayGlyph({
  status,
  isToday,
  index,
}: {
  status: DayStatus
  isToday: boolean
  index: number
}) {
  const active = useScreenActive()
  const trained = status === 'trained'

  const breath = useSharedValue(0.5)
  useEffect(() => {
    if (!trained) {
      breath.value = 0
      return
    }
    if (!active) {
      cancelAnimation(breath)
      breath.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.quad) })
      return
    }
    breath.value = withDelay(
      (index % 7) * 220,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
    return () => cancelAnimation(breath)
  }, [trained, index, breath, active])

  const animStyle = useAnimatedStyle(() => {
    if (!trained) return { opacity: 1, transform: [{ scale: 1 }] }
    return {
      opacity: 0.78 + breath.value * 0.22,
      transform: [{ scale: 1 + breath.value * 0.08 }],
    }
  })

  // Resolve the path + paint per status.
  let path = STAR_PATH
  let fill: string = 'none'
  let stroke: string = 'none'
  let strokeW = 0
  if (status === 'trained') {
    fill = isToday ? colors.magenta : colors.leche
  } else if (status === 'rested') {
    path = MOON_PATH
    fill = colors.niebla
  } else {
    // empty
    stroke = isToday ? colors.magenta : colors.niebla
    strokeW = 1.6
  }

  return (
    <Animated.View style={[styles.starGlyph, animStyle, status === 'rested' && styles.moonGlyph]}>
      <Svg width={STAR_SIZE} height={STAR_SIZE} viewBox="0 0 24 24">
        <Path d={path} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  )
}

/* Small gold marker for a day that carries an event/revelation. Solo un
 * punto de presencia — el detalle (cuáles y cuántos) vive en el panel, no
 * en un "+N" críptico en la tira. */
function EventDot({ count }: { count: number }) {
  // Always reserve the row so columns with/without events stay the same
  // height; only paint the marker when an event landed that day.
  return (
    <View style={styles.eventRow} pointerEvents="none">
      {count > 0 ? <View style={styles.eventDot} /> : null}
    </View>
  )
}

/* One day column. Its scale + opacity track the live scroll offset:
 * as the column approaches the left edge it eases down to a dimmed,
 * slightly smaller state, then back to full as it scrolls into view. */
function DayColumn({
  day,
  index,
  scrollX,
  selected,
  onSelect,
}: {
  day: CalendarDay
  index: number
  scrollX: SharedValue<number>
  selected: boolean
  onSelect: (date: string) => void
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

  const glow = day.status === 'trained'
  const a11yStatus =
    day.status === 'trained'
      ? 'entrenaste'
      : day.status === 'rested'
        ? 'descansaste'
        : 'sin registro'

  return (
    <Animated.View style={[styles.colBox, animStyle]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {})
          onSelect(day.date)
        }}
        style={({ pressed }) => [
          styles.col,
          selected && styles.colSelected,
          pressed && styles.colPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${day.date}, ${a11yStatus}`}
        accessibilityHint="Toca para ver el detalle del día"
        accessibilityState={{ selected }}
      >
        <Text
          style={[
            styles.dayLetter,
            day.status !== 'empty' && styles.dayLetterMarked,
            day.isToday && styles.dayLetterToday,
          ]}
        >
          {day.isToday ? 'HOY' : (SPANISH_DAY_INITIAL[day.weekdayIdx] ?? '?')}
        </Text>
        <Text
          style={[
            styles.dayNum,
            day.status !== 'empty' && styles.dayNumMarked,
            day.isToday && styles.dayNumToday,
          ]}
        >
          {day.dayNum}
        </Text>
        <View style={styles.starWrap}>
          {glow ? <StarGlow /> : null}
          <DayGlyph status={day.status} isToday={day.isToday} index={index} />
        </View>
        <EventDot count={day.events.length} />
      </Pressable>
    </Animated.View>
  )
}

/**
 * A horizontally scrollable strip of the last 30 days — the editable
 * history surface + the constellation's official editor. Each day is a
 * bare column (weekday letter, number, status glyph, optional gold event
 * dot) with no card chrome, so the strip reads in the same airy language
 * as the constellation above it. Today is the rightmost column —
 * labelled "HOY", magenta, haloed — and the strip opens scrolled to it.
 * Tapping a column SELECTS that day (opening the detail panel below);
 * marking entrenó/descansó happens from the panel's buttons.
 */
export function WeekStrip({ days, selectedDate, onSelect }: Props) {
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
          selected={selectedDate === d.date}
          onSelect={onSelect}
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
  // No card, no border — each day is just letter / number / glyph in an
  // airy column. The selected day gets a soft magenta ring.
  col: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colSelected: {
    borderColor: colors.magenta,
    backgroundColor: colors.magentaTint,
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
  dayLetterMarked: {
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
  dayNumMarked: {
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
  // The crescent reads better a hair smaller than the 4-point star.
  moonGlyph: {
    opacity: 0.9,
    transform: [{ scale: 0.92 }],
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
  // Gold event marker under the glyph.
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 10,
    marginTop: 5,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.oro,
  },
})
