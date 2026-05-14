import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

const SPANISH_DAY_INITIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const

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

const BAR_GRADIENT = {
  today: ['rgba(233,30,99,0.30)', colors.magenta] as readonly [string, string],
  trained: ['rgba(244,236,222,0.18)', 'rgba(244,236,222,0.55)'] as readonly [string, string],
  empty: ['rgba(79,58,61,0)', 'rgba(79,58,61,0.4)'] as readonly [string, string],
}

function barHeight(d: WeekDayCell): '100%' | '60%' | '8%' {
  if (d.isToday) return '100%'
  if (d.trained) return '60%'
  return '8%'
}

function barGradient(d: WeekDayCell) {
  if (d.isToday) return BAR_GRADIENT.today
  if (d.trained) return BAR_GRADIENT.trained
  return BAR_GRADIENT.empty
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
            <View pointerEvents="none" style={[styles.bar, { height: barHeight(d) }]}>
              <LinearGradient
                colors={barGradient(d)}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
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
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
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
