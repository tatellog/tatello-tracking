import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

// weekdayIdx is 0..6 (0=Sun). Spanish convention disambiguates the
// martes/miércoles "M/M" collision by writing Wednesday as "X".
const SPANISH_DAY_INITIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
const SPANISH_DAY_FULL = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const
const SPANISH_MONTH = [
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
] as const

// 4-point star, viewBox 24×24, centred (12,12). Outer r≈10, inner
// r≈3.2 — same iconography as the Hoy-tab constellation so a marked
// day reads as "another lit star in your figure".
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

const STAR_SIZE = 22
const CONNECTOR_THICKNESS = 2

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

/** Human, screen-reader-friendly date — "jueves 15 de mayo" beats the
 *  raw ISO string, which a screen reader spells out digit by digit. */
function humanDate(d: WeekDayCell): string {
  const monthIdx = (Number(d.date.split('-')[1]) || 1) - 1
  const weekday = SPANISH_DAY_FULL[d.weekdayIdx] ?? ''
  const month = SPANISH_MONTH[monthIdx] ?? ''
  return `${weekday} ${d.dayNum} de ${month}`
}

/* A faint segment linking a trained day to the next trained day — a
 * gap in the run renders no segment, so a streak reads as one short
 * constellation.
 *
 * It lives *inside* the star's box and is centred with `top: '50%'`.
 * Because the star is flex-centred in that same box, 50% of the box
 * IS the star's vertical centre — by construction, not by a measured
 * or guessed offset. So the line can never drift off the star row.
 * Horizontally it runs centre-to-centre — a full column wide — and
 * passes *behind* both stars (they carry a higher zIndex), so the
 * line reads as one continuous thread the stars sit on. */
function Connector({ width }: { width: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(420)}
      style={[styles.connector, { width }]}
    />
  )
}

/* Soft magenta halo behind a star — two concentric translucent discs
 * plus an iOS shadow bloom fake a radial glow without a gradient.
 * Rendered for today (always) and for any day in its 800 ms
 * just-marked window, so marking a past day blooms it alive. */
function StarGlow() {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(360)}
      exiting={FadeOut.duration(420)}
      style={styles.glowOuter}
    >
      <View style={styles.glowInner} />
    </Animated.View>
  )
}

/* Per-day star. States:
 *   trained          → filled star (cream past days, magenta today)
 *   today, untrained → magenta outline — "this is the spot to light"
 *   past, untrained  → dim niebla outline — quiet, waiting
 * Tapping the column toggles the day, so backfilling past workouts is
 * just tapping each star on.
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

export function WeekStrip({ days, onToggle, justMarkedIdx = null }: Props) {
  // The only measurement: row width → column width. The connector
  // spans exactly one column (centre-to-centre); its vertical
  // placement needs no measuring (see Connector).
  const [rowWidth, setRowWidth] = useState<number | null>(null)
  const connectorWidth = rowWidth != null ? rowWidth / Math.max(1, days.length) : 0

  const handleRowLayout = (e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width)
  }

  return (
    <View style={styles.row} onLayout={handleRowLayout}>
      {days.map((d, i) => {
        const glow = d.isToday || justMarkedIdx === i
        const connectsNext = d.trained && (days[i + 1]?.trained ?? false)
        return (
          <Pressable
            key={d.date}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onToggle(d.date)
            }}
            style={({ pressed }) => [styles.col, pressed && styles.colPressed]}
            accessibilityRole="button"
            accessibilityHint={d.trained ? 'Tocar para desmarcar' : 'Tocar para marcar entreno'}
            accessibilityLabel={`${humanDate(d)}, ${d.trained ? 'entrenado' : 'sin entrenar'}`}
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
              {connectsNext && connectorWidth > 0 ? <Connector width={connectorWidth} /> : null}
              {glow ? <StarGlow /> : null}
              <DayStar trained={d.trained} isToday={d.isToday} index={i} />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginTop: 6,
  },
  // No card, no border — each day is just letter / number / star in
  // an airy column. State legibility comes from brightness (dim =
  // pending, cream = done) and the star fill, not from box chrome.
  col: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  colPressed: {
    opacity: 0.55,
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
    color: colors.bone,
  },
  dayLetterToday: {
    color: colors.magenta,
  },
  dayNum: {
    marginTop: 3,
    fontFamily: typography.displayHeavy,
    fontSize: 17,
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
  // containing block for the absolutely-placed connector and glow.
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
  // top:'50%' = the star's vertical centre (star is flex-centred in
  // starWrap); the negative marginTop re-centres the line's own
  // thickness. left:'50%' = this star's centre x; the width (one
  // column) carries it to the next star's centre. zIndex 0 keeps it
  // behind the stars (starGlyph is zIndex 1).
  connector: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -CONNECTOR_THICKNESS / 2,
    height: CONNECTOR_THICKNESS,
    backgroundColor: colors.hairlineStrong,
    zIndex: 0,
  },
  // Outer + inner translucent discs, centred on the STAR_SIZE box,
  // overflowing it freely (no clipping). The shadow adds an iOS bloom.
  glowOuter: {
    position: 'absolute',
    width: 48,
    height: 48,
    top: (STAR_SIZE - 48) / 2,
    left: (STAR_SIZE - 48) / 2,
    borderRadius: 24,
    backgroundColor: colors.magentaTint,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 4,
  },
  glowInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.magentaTint2,
  },
})
