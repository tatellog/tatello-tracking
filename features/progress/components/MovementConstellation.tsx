import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { useRecentWorkoutDates } from '../hooks'

const DAY_MS = 24 * 60 * 60 * 1000

/* ─────────────────────── Geometry ─────────────────────── */

const COLS = 7
const ROWS = 4 // 28 days
const TOTAL = COLS * ROWS

// Each dot sits in a square cell; the SVG is sized to the parent
// width via viewBox so the cells scale together. Tuned so the dots
// breathe without the lit dots' shadows clipping.
const CELL = 36
const CANVAS_W = COLS * CELL
const CANVAS_H = ROWS * CELL
const DOT_LIT_R = 4.5
const DOT_REST_R = 1.6

/** YYYY-MM-DD in local time. */
function ymdLocal(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * 28-day movement constellation. Each day = one dot; lit (magenta)
 * if the user trained that day, faint cream otherwise. The grid
 * reads top-left → bottom-right chronologically, with today at the
 * bottom-right corner.
 *
 * Same cosmic vocabulary as the LunarConstellation in Hoy, but
 * miniature and grid-based. Reads at a glance: "is my month
 * lighting up?".
 */
export function MovementConstellation() {
  const workouts = useRecentWorkoutDates(40)

  const { days, litCount, weekdayLabels } = useMemo(() => {
    const trainedSet = new Set(workouts.data ?? [])
    const out: { date: string; lit: boolean }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Build 28 days oldest → newest so the grid reads
    // top-left (oldest) to bottom-right (today). Each row is exactly
    // 7 days, so every column lands on the same weekday — that's why
    // we only need ONE set of labels (computed from the bottom row)
    // and they apply to every row above.
    for (let i = TOTAL - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS)
      const ymd = ymdLocal(d)
      out.push({ date: ymd, lit: trainedSet.has(ymd) })
    }
    const lit = out.filter((d) => d.lit).length
    // Weekday for each column = the weekday of the bottom row's
    // corresponding day. col 0 = 6 days ago, col 6 = today.
    const WD = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
    const labels = Array.from({ length: COLS }, (_, col) => {
      const daysAgo = COLS - 1 - col
      const d = new Date(today.getTime() - daysAgo * DAY_MS)
      return WD[d.getDay()] ?? ''
    })
    return { days: out, litCount: lit, weekdayLabels: labels }
  }, [workouts.data])

  return (
    <Animated.View entering={FadeIn.duration(360).delay(80)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Movimiento · 28 días
      </EyebrowLabel>

      <View style={styles.card}>
        {/* Weekday labels above the grid — every column is a fixed
            weekday (col 0 = 6 days ago's weekday, col 6 = today's).
            Reveals patterns like "I always train Mondays" at a glance. */}
        <View style={styles.weekdayRow}>
          {weekdayLabels.map((w, i) => (
            <Text key={`wd-${i}`} style={styles.weekdayLabel}>
              {w}
            </Text>
          ))}
        </View>

        <Svg
          width="100%"
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Thin connecting hairlines along each row — give the grid
              a "thread" feel, like the constellation. Very faint. */}
          {Array.from({ length: ROWS }, (_, r) => (
            <Line
              key={`row-${r}`}
              x1={CELL / 2}
              y1={r * CELL + CELL / 2}
              x2={CANVAS_W - CELL / 2}
              y2={r * CELL + CELL / 2}
              stroke="#FFFFFF"
              strokeOpacity={0.04}
              strokeWidth={0.6}
            />
          ))}

          {days.map((d, i) => {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const cx = col * CELL + CELL / 2
            const cy = row * CELL + CELL / 2
            const isToday = i === TOTAL - 1
            return <DayDot key={d.date} cx={cx} cy={cy} lit={d.lit} isToday={isToday} />
          })}
        </Svg>

        <View style={styles.footer}>
          <Text style={styles.footerNum}>{litCount}</Text>
          <Text style={styles.footerLabel}>
            {litCount === 1 ? 'entreno' : 'entrenos'} en 28 días
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

/* Single dot — bright magenta with bloom when lit, faint cream when
 * not. Today's cell adds a thin ring so the chronology has an
 * anchor. */
function DayDot({
  cx,
  cy,
  lit,
  isToday,
}: {
  cx: number
  cy: number
  lit: boolean
  isToday: boolean
}) {
  if (lit) {
    return (
      <>
        <Circle cx={cx} cy={cy} r={DOT_LIT_R * 2.2} fill={colors.magenta} opacity={0.12} />
        <Circle cx={cx} cy={cy} r={DOT_LIT_R * 1.5} fill={colors.magenta} opacity={0.28} />
        <Circle cx={cx} cy={cy} r={DOT_LIT_R} fill={colors.magenta} />
        <Circle cx={cx} cy={cy} r={DOT_LIT_R * 0.4} fill="#FFFFFF" opacity={0.85} />
        {isToday ? (
          <Circle
            cx={cx}
            cy={cy}
            r={DOT_LIT_R + 5}
            fill="none"
            stroke="#F4ECDE"
            strokeWidth={1}
            opacity={0.6}
          />
        ) : null}
      </>
    )
  }
  return (
    <>
      <Circle cx={cx} cy={cy} r={DOT_REST_R + 1.2} fill="#FBD7E3" opacity={0.08} />
      <Circle cx={cx} cy={cy} r={DOT_REST_R} fill="#F4ECDE" opacity={0.35} />
      {isToday ? (
        <Circle
          cx={cx}
          cy={cy}
          r={DOT_REST_R + 4}
          fill="none"
          stroke="#F4ECDE"
          strokeWidth={1}
          opacity={0.5}
        />
      ) : null}
    </>
  )
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
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    paddingHorizontal: CELL / 2,
  },
  weekdayLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    letterSpacing: 1.4,
    width: CELL,
    textAlign: 'center',
  },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  footerNum: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.segmentTitle,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  footerLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
})
