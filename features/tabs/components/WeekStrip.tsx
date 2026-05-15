import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

const SPANISH_DAY_INITIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const

// 4-point star, viewBox 24×24, centred (12,12). Outer r≈10, inner
// r≈3.2 — same iconography as the Hoy-tab constellation so a marked
// day reads as "another lit star in your figure".
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

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

/* Per-day star. Three states:
 *   trained        → filled star (cream for past days, magenta today)
 *   today, untrained → magenta outline — "this is the spot to light"
 *   past, untrained  → dim niebla outline — quiet, waiting
 * Tapping the cell toggles the day, so backfilling a week of past
 * workouts is just tapping each star on.
 *
 * Trained stars breathe (opacity + slight scale) on a slow loop so a
 * marked day reads as alive, matching the lit stars in the Hoy-tab
 * constellation. Per-index delay desynchronises the row. Untrained
 * outlines stay static — they are still "waiting". */
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
      index * 220,
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
    <Animated.View style={animStyle}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
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

export function WeekStrip({ days, onToggle, justMarkedIdx = null }: Props) {
  return (
    <View style={styles.row}>
      {days.map((d, i) => {
        const isJust = justMarkedIdx === i
        return (
          <Pressable
            key={d.date}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onToggle(d.date)
            }}
            style={[styles.cell, d.isToday && styles.cellToday, isJust && styles.cellJustMarked]}
            accessibilityRole="button"
            accessibilityLabel={`${d.date}, ${d.trained ? 'entrenado' : 'no entrenado'}`}
            accessibilityState={{ selected: d.trained }}
          >
            <Text
              style={[
                styles.dayLetter,
                d.trained && styles.dayLetterTrained,
                d.isToday && styles.dayLetterToday,
              ]}
            >
              {SPANISH_DAY_INITIAL[d.weekdayIdx] ?? '?'}
            </Text>
            <Text
              style={[
                styles.dayNum,
                d.trained && styles.dayNumTrained,
                d.isToday && styles.dayNumToday,
              ]}
            >
              {d.dayNum}
            </Text>
            <View style={styles.starWrap}>
              <DayStar trained={d.trained} isToday={d.isToday} index={i} />
            </View>
            {d.isToday ? <Text style={styles.todayLabel}>HOY</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  cell: {
    flex: 1,
    minHeight: 88,
    position: 'relative',
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.bruma,
    borderRadius: 6,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  cellToday: {
    borderColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
    transform: [{ scale: 1.06 }],
    zIndex: 2,
  },
  cellJustMarked: {
    shadowColor: colors.magenta,
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  dayLetter: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  dayLetterTrained: {
    color: colors.leche,
  },
  dayLetterToday: {
    color: colors.magenta,
  },
  dayNum: {
    marginTop: 4,
    fontFamily: typography.displayHeavy,
    fontSize: 18,
    color: colors.bone,
    letterSpacing: -0.7,
    lineHeight: 18,
  },
  dayNumTrained: {
    color: colors.leche,
  },
  dayNumToday: {
    color: colors.leche,
    zIndex: 1,
  },
  // marginTop:auto pushes the star toward the bottom of the cell so
  // the letter/number sit at the top and the star anchors the base —
  // a small constellation node in each day.
  starWrap: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  todayLabel: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: colors.magenta,
    borderRadius: 2,
    fontFamily: typography.uiBold,
    fontSize: 7.5,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    overflow: 'hidden',
  },
})
