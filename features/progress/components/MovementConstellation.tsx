import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import {
  buildMonthGrid,
  effectiveTrainingPhrase,
} from '@/features/tabs/components/constellation/data/month-grid'
import { todayInTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

import { useAllWorkoutDates, useTotalTrainedDays } from '../hooks'

const COLS = 7
const CELL = 34
const WD = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// Scene colours (same palette as Día/Semana flares — not theme tokens).
const MAGENTA = '#E91E63'
const LECHE = '#F4ECDE'

/*
 * Movement hero — the all-time trained-days counter PLUS a browsable
 * month rendered as a night sky: each trained day is a lit STAR (a 4-point
 * diffraction flare with a white-hot core), today is the brightest, days
 * still to come are near-invisible canvas (never debt), and rested days
 * are quiet dust. The ‹ › arrows step back through history. No streak, no
 * countdown (manifiesto): the counter only grows.
 */
export function MovementConstellation() {
  const total = useTotalTrainedDays()
  const allWorkouts = useAllWorkoutDates()
  const today = todayInTimezone()

  // 0 = current month, 1 = last month, … — how far back we're browsing.
  const [monthsBack, setMonthsBack] = useState(0)

  const { month, firstWeekday, rows, monthLabel, isCurrentMonth } = useMemo(() => {
    const [ty, tm] = today.split('-').map(Number) as [number, number]
    const ref = new Date(ty, tm - 1 - monthsBack, 1)
    const ry = ref.getFullYear()
    const rm = ref.getMonth() + 1 // 1-based
    const monthRef = `${ry}-${String(rm).padStart(2, '0')}-01`
    const m = buildMonthGrid(monthRef, allWorkouts.data ?? [], today)
    const fw = new Date(ry, rm - 1, 1).getDay() // 0 = Sunday
    // Drop the year unless we've scrolled out of the current one.
    const label = ry === ty ? (MONTHS[rm - 1] ?? '') : `${MONTHS[rm - 1] ?? ''} ${ry}`
    return {
      month: m,
      firstWeekday: fw,
      rows: Math.ceil((fw + m.daysInMonth) / COLS),
      monthLabel: label,
      isCurrentMonth: monthsBack === 0,
    }
  }, [today, allWorkouts.data, monthsBack])

  const count = total.data ?? 0
  const canvasW = COLS * CELL
  const canvasH = rows * CELL

  const step = (delta: number): void => {
    Haptics.selectionAsync().catch(() => {})
    // Can't browse into the future; cap at the current month.
    setMonthsBack((b) => Math.max(0, b + delta))
  }

  const trained = month.trainedThisMonth
  // Warm, no-guilt month line — never "0/30". A quiet month is a pause.
  const monthLine =
    trained > 0
      ? `${trained} ${trained === 1 ? 'día' : 'días'} en movimiento`
      : isCurrentMonth
        ? 'tu mes empieza'
        : 'un mes en pausa'

  return (
    <Animated.View entering={FadeIn.duration(360).delay(80)}>
      <EyebrowLabel tone="magenta" size={10} style={styles.eyebrow}>
        Movimiento
      </EyebrowLabel>

      <View style={styles.card}>
        {/* The all-time counter — the hero number. */}
        <View style={styles.countRow}>
          <Text style={styles.bigNum}>{count}</Text>
          <Text style={styles.countLabel}>{count === 1 ? 'día entrenado' : 'días entrenados'}</Text>
        </View>
        {/* Human milestone, once a full month of effective training is in. */}
        {count >= 30 ? (
          <Text style={styles.milestone}>{effectiveTrainingPhrase(count)} de entreno efectivo</Text>
        ) : null}

        {/* Browsable month header — ‹ MONTH ◇ count › */}
        <View style={styles.monthHead}>
          <Pressable onPress={() => step(1)} hitSlop={12} style={styles.navHit}>
            <Text style={styles.navArrow}>‹</Text>
          </Pressable>
          <View style={styles.monthLabelWrap}>
            <Text style={styles.monthName}>{monthLabel}</Text>
            <View style={styles.monthCountRow}>
              <View style={styles.gem} />
              <Text style={styles.monthCount}>{monthLine}</Text>
              <View style={styles.gem} />
            </View>
          </View>
          <Pressable
            onPress={() => step(-1)}
            disabled={isCurrentMonth}
            hitSlop={12}
            style={styles.navHit}
          >
            <Text style={[styles.navArrow, isCurrentMonth && styles.navArrowOff]}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WD.map((w, i) => (
            <Text key={`wd-${i}`} style={styles.weekdayLabel}>
              {w}
            </Text>
          ))}
        </View>

        <Svg
          width="100%"
          height={canvasH}
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <Defs>
            {/* Feathered magenta halo around a lit star. */}
            <RadialGradient id="mov-aura" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={MAGENTA} stopOpacity={0.42} />
              <Stop offset="38%" stopColor={MAGENTA} stopOpacity={0.2} />
              <Stop offset="72%" stopColor="#FBD7E3" stopOpacity={0.07} />
              <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
            </RadialGradient>
            {/* White-hot bloom → magenta, the "blown-out" core glow. */}
            <RadialGradient id="mov-bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.92} />
              <Stop offset="30%" stopColor="#FFE9D6" stopOpacity={0.55} />
              <Stop offset="70%" stopColor={MAGENTA} stopOpacity={0.18} />
              <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
            </RadialGradient>
            {/* Feathered streak — stretches to each ellipse's bbox to
                draw an anamorphic light spike. */}
            <RadialGradient id="mov-streak" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="40%" stopColor="#FFFFFF" stopOpacity={0.35} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            {/* Faint sky well behind the grid — turns "panel" into
                "window onto the night". */}
            <RadialGradient id="mov-sky" cx="50%" cy="50%" r="62%">
              <Stop offset="0%" stopColor="#1F0E13" stopOpacity={0.5} />
              <Stop offset="100%" stopColor="#1F0E13" stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#mov-sky)" />

          {month.cells.map((cell, i) => {
            const k = firstWeekday + i
            const col = k % COLS
            const row = Math.floor(k / COLS)
            const cx = col * CELL + CELL / 2
            const cy = row * CELL + CELL / 2
            return (
              <DayDot
                key={cell.date}
                cx={cx}
                cy={cy}
                lit={cell.trained}
                isToday={cell.isToday}
                isFuture={cell.isFuture}
              />
            )
          })}
        </Svg>
      </View>
    </Animated.View>
  )
}

/* The day, as a point of sky. Four states, deliberately ranked:
 *   trained        → a 4-point diffraction flare (today = the brightest)
 *   today (open)   → a clear cream anchor + ring — "your day, still open"
 *   past (rested)  → quiet dust, low — a pause, never a hole
 *   future         → ghost — blank canvas, almost no weight (no debt)
 */
function DayDot({
  cx,
  cy,
  lit,
  isToday,
  isFuture,
}: {
  cx: number
  cy: number
  lit: boolean
  isToday: boolean
  isFuture: boolean
}) {
  if (lit) return <FlareStar cx={cx} cy={cy} hero={isToday} />
  if (isToday) {
    // Today, not yet trained — the chronological anchor, unmistakable
    // but neutral (no magenta = no false "done").
    return (
      <>
        <Circle cx={cx} cy={cy} r={9} fill="none" stroke={LECHE} strokeWidth={0.9} opacity={0.7} />
        <Circle cx={cx} cy={cy} r={2.4} fill={LECHE} opacity={0.62} />
      </>
    )
  }
  if (isFuture) {
    // Hasn't happened — barely there. The month is not pre-owed.
    return <Circle cx={cx} cy={cy} r={1.4} fill={LECHE} opacity={0.06} />
  }
  // Past, rested — quiet dust, well below the lit stars.
  return <Circle cx={cx} cy={cy} r={1.5} fill={LECHE} opacity={0.24} />
}

/* A lit day = a star with a 4-point anamorphic flare + white-hot core.
 * `hero` (today + trained) is the brightest star of the month: scaled
 * up, two sparkles, and a cream observation ring. */
function FlareStar({ cx, cy, hero }: { cx: number; cy: number; hero: boolean }) {
  const rot = (deg: number): string => `rotate(${deg}, ${cx}, ${cy})`
  if (hero) {
    return (
      <>
        <Circle cx={cx} cy={cy} r={16} fill="url(#mov-aura)" />
        <Ellipse cx={cx} cy={cy} rx={16} ry={1.6} fill="url(#mov-streak)" opacity={0.85} />
        <Ellipse cx={cx} cy={cy} rx={1.4} ry={12} fill="url(#mov-streak)" opacity={0.68} />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={8.5}
          ry={1}
          fill="url(#mov-streak)"
          opacity={0.45}
          transform={rot(45)}
        />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={8.5}
          ry={1}
          fill="url(#mov-streak)"
          opacity={0.45}
          transform={rot(-45)}
        />
        <Circle cx={cx} cy={cy} r={7.2} fill="url(#mov-bloom)" />
        <Circle cx={cx} cy={cy} r={3.8} fill={MAGENTA} />
        <Circle cx={cx} cy={cy} r={1.7} fill="#FFFFFF" opacity={0.97} />
        <Circle cx={cx + 7} cy={cy - 4.5} r={0.8} fill="#FFFFFF" opacity={0.6} />
        <Circle cx={cx - 6} cy={cy + 5} r={0.6} fill="#FFFFFF" opacity={0.5} />
        <Circle
          cx={cx}
          cy={cy}
          r={11}
          fill="none"
          stroke={LECHE}
          strokeWidth={0.7}
          opacity={0.55}
        />
      </>
    )
  }
  return (
    <>
      <Circle cx={cx} cy={cy} r={15} fill="url(#mov-aura)" />
      <Ellipse cx={cx} cy={cy} rx={14} ry={1.4} fill="url(#mov-streak)" opacity={0.8} />
      <Ellipse cx={cx} cy={cy} rx={1.2} ry={10} fill="url(#mov-streak)" opacity={0.62} />
      <Ellipse
        cx={cx}
        cy={cy}
        rx={7}
        ry={1}
        fill="url(#mov-streak)"
        opacity={0.4}
        transform={rot(45)}
      />
      <Ellipse
        cx={cx}
        cy={cy}
        rx={7}
        ry={1}
        fill="url(#mov-streak)"
        opacity={0.4}
        transform={rot(-45)}
      />
      <Circle cx={cx} cy={cy} r={6.5} fill="url(#mov-bloom)" />
      <Circle cx={cx} cy={cy} r={3.6} fill={MAGENTA} />
      <Circle cx={cx} cy={cy} r={1.5} fill="#FFFFFF" opacity={0.95} />
      <Circle cx={cx + 6.5} cy={cy - 4} r={0.7} fill="#FFFFFF" opacity={0.55} />
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
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
  },
  bigNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 50,
    lineHeight: 52,
    color: colors.magenta,
    letterSpacing: -1,
  },
  countLabel: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  milestone: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.bone,
    marginTop: 4,
  },
  monthHead: {
    marginTop: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navHit: {
    paddingHorizontal: 6,
  },
  navArrow: {
    fontFamily: typography.displaySemi,
    fontSize: 26,
    lineHeight: 28,
    color: colors.leche,
    opacity: 0.85,
  },
  navArrowOff: {
    opacity: 0.18,
  },
  monthLabelWrap: {
    alignItems: 'center',
  },
  monthName: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  monthCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 3,
  },
  // Tiny magenta rhombus flanking the month line — the art-deco /
  // star-chart motif reused from the constellation tooltip.
  gem: {
    width: 4,
    height: 4,
    backgroundColor: colors.magenta,
    opacity: 0.7,
    transform: [{ rotate: '45deg' }],
  },
  monthCount: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    paddingHorizontal: CELL / 2,
    opacity: 0.55, // labels are cartography — they whisper, not shout.
  },
  weekdayLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    letterSpacing: 1.2,
    width: CELL,
    textAlign: 'center',
  },
})
