import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { BriefContext, StreakCell } from '@/features/brief/api'
import { Day1Celebration, HomeError, HomeSkeleton } from '@/features/home/components'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import { useProfile } from '@/features/profile/hooks'
import { useToggleWorkoutForDate, useToggleWorkoutToday } from '@/features/streak/hooks'
import {
  LunarConstellation,
  PrimaryCta,
  RingCard,
  SectionHeader,
  SlideToConfirm,
  TabHeader,
  WeekStrip,
  type WeekDayCell,
} from '@/features/tabs/components'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

const CELEBRATION_MS = 2000
const SPANISH_WEEKDAY_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'] as const

function makeEnter(cadence: Cadence) {
  if (cadence === 'reduced') return (_d: number) => FadeIn.duration(220)
  return (d: number) => FadeInDown.duration(380).delay(d).springify().damping(18)
}

// Local-zoned day-of-week from 'YYYY-MM-DD'. Avoids the UTC-midnight
// drift west of UTC that `new Date('YYYY-MM-DD')` introduces.
function dayOfWeekOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

function dayNumOf(iso: string): number {
  return Number(iso.split('-')[2]) || 1
}

export default function TodayScreen() {
  const brief = useHomeBrief()
  const cadence = useHomeCadence()
  useDayRollover(brief.data?.date)

  if (brief.isError && !brief.data) return <HomeError onRetry={brief.refetch} />

  if (brief.isLoading || !brief.data || cadence == null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return <TodayContent ctx={brief.data} cadence={cadence} />
}

type ContentProps = { ctx: BriefContext; cadence: Cadence }

function TodayContent({ ctx, cadence }: ContentProps) {
  const qc = useQueryClient()
  const router = useRouter()
  const { data: profile } = useProfile()

  const toggleToday = useToggleWorkoutToday()
  const toggleForDate = useToggleWorkoutForDate()

  const [showCelebration, setShowCelebration] = useState(false)
  const [justMarkedIdx, setJustMarkedIdx] = useState<number | null>(null)
  /** Offset relative to the current 4-week window: 0 = current, -1 = previous, etc. */
  const [weekOffset, setWeekOffset] = useState(0)

  // Slice grid_28_days into 4 weeks of 7. Index 3 (last) = current week.
  const weeks = useMemo<readonly (readonly StreakCell[])[]>(() => {
    const buckets: StreakCell[][] = [[], [], [], []]
    ctx.grid_28_days.forEach((cell, idx) => {
      const bucketIdx = Math.floor(idx / 7)
      if (bucketIdx >= 0 && bucketIdx < 4 && buckets[bucketIdx]) {
        buckets[bucketIdx]!.push(cell)
      }
    })
    return buckets
  }, [ctx.grid_28_days])

  const currentWeekIdx = weeks.length - 1 + weekOffset
  const visibleWeek = weeks[Math.max(0, Math.min(weeks.length - 1, currentWeekIdx))] ?? []
  const isCurrentWeek = weekOffset === 0
  const canGoPrev = currentWeekIdx > 0
  const canGoNext = weekOffset < 0
  const weekLabel = isCurrentWeek
    ? 'Esta semana'
    : weekOffset === -1
      ? 'Semana pasada'
      : `Hace ${-weekOffset} sem`

  const todayCell = ctx.grid_28_days[27] // brief guarantees length 28
  const todayIsoLocal = ctx.date

  const weekDays: WeekDayCell[] = visibleWeek.map((cell) => ({
    date: cell.date,
    trained: cell.completed,
    dayNum: dayNumOf(cell.date),
    weekdayIdx: dayOfWeekOf(cell.date),
    isToday: cell.date === todayIsoLocal,
  }))

  const trainedThisMonth = ctx.grid_28_days.filter((c) => c.completed).length

  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const todayPill = useMemo(() => {
    const now = new Date()
    const weekday = SPANISH_WEEKDAY_SHORT[now.getDay()] ?? 'HOY'
    const day = now.getDate()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    return { full: `${weekday} ${day} · ${hh}:${mm}`, emphasis: weekday }
  }, [])

  const greetingName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  const handleSlideConfirm = () => {
    const wasFirstDay = isFirstDay
    toggleToday.mutate(true)
    if (wasFirstDay) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      setShowCelebration(true)
      setTimeout(() => {
        setShowCelebration(false)
        qc.invalidateQueries({ queryKey: queryKeys.profile.all })
      }, CELEBRATION_MS)
    }
  }

  const handleSlideUndo = () => {
    toggleToday.mutate(false)
  }

  const handleToggleDay = (date: string) => {
    const cell = ctx.grid_28_days.find((c) => c.date === date)
    if (!cell) return
    const idx = visibleWeek.findIndex((c) => c.date === date)
    if (idx >= 0) {
      setJustMarkedIdx(idx)
      setTimeout(() => setJustMarkedIdx(null), 800)
    }
    toggleForDate.mutate({ date, complete: !cell.completed })
  }

  const enter = makeEnter(cadence)

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(40)}>
            <TabHeader
              greeting={`Hola, ${greetingName}.`}
              greetingEmphasis={greetingName}
              pillLabel={todayPill.full}
              pillEmphasis={todayPill.emphasis}
            />
          </Animated.View>

          <Animated.View entering={enter(120)}>
            <SlideToConfirm
              committed={ctx.today_workout_completed}
              onConfirm={handleSlideConfirm}
              onUndo={handleSlideUndo}
            />
          </Animated.View>

          <Animated.View entering={enter(220)}>
            <SectionHeader
              label="Tu Acuario · 28 días"
              meta={{ value: String(trainedThisMonth), label: 'de 28' }}
            />
          </Animated.View>

          <Animated.View entering={enter(320)}>
            <LunarConstellation trained={ctx.grid_28_days.map((c) => c.completed)} todayIdx={27} />
          </Animated.View>

          <Animated.View entering={enter(420)}>
            <Text style={styles.coachLine}>
              Tu cuerpo lo está <Text style={styles.coachLineEm}>registrando</Text>. Aunque no lo
              veas todavía.
            </Text>
          </Animated.View>

          {ctx.targets ? (
            <>
              <Animated.View entering={enter(520)}>
                <SectionHeader label="Macros de hoy" meta="recomp" />
              </Animated.View>
              <Animated.View entering={enter(580)} style={styles.macroRow}>
                <RingCard
                  label="Proteína"
                  value={ctx.today_macros.protein_g}
                  target={ctx.targets.protein_g}
                  formatted={Math.round(ctx.today_macros.protein_g).toString()}
                  unitSuffix={`de ${ctx.targets.protein_g} g`}
                  ringColor={colors.magenta}
                  ringDelay={400}
                />
                <RingCard
                  label="Calorías"
                  value={ctx.today_macros.calories}
                  target={ctx.targets.calories}
                  formatted={formatKcal(ctx.today_macros.calories)}
                  unitSuffix={`de ${formatKcal(ctx.targets.calories)} k`}
                  ringColor={colors.bone}
                  ringDelay={600}
                  small
                />
              </Animated.View>
            </>
          ) : null}

          <Animated.View entering={enter(680)}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>{weekLabel}</Text>
              <View style={styles.weekNav}>
                <Pressable
                  onPress={() => canGoPrev && setWeekOffset(weekOffset - 1)}
                  disabled={!canGoPrev}
                  style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
                  accessibilityLabel="Semana anterior"
                >
                  <Text style={styles.navGlyph}>‹</Text>
                </Pressable>
                <Text style={styles.weekRange}>
                  {visibleWeek[0]?.date ? dayNumOf(visibleWeek[0].date) : ''}–
                  {visibleWeek[6]?.date ? dayNumOf(visibleWeek[6].date) : ''}
                </Text>
                <Pressable
                  onPress={() => canGoNext && setWeekOffset(weekOffset + 1)}
                  disabled={!canGoNext}
                  style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
                  accessibilityLabel="Semana siguiente"
                >
                  <Text style={styles.navGlyph}>›</Text>
                </Pressable>
              </View>
            </View>
            <WeekStrip days={weekDays} onToggle={handleToggleDay} justMarkedIdx={justMarkedIdx} />
          </Animated.View>

          <Animated.View entering={enter(820)}>
            <PrimaryCta
              label="Sumar comida →"
              onPress={() => router.push('/log-meal')}
              marginTop={28}
              marginBottom={20}
            />
          </Animated.View>

          {todayCell ? null : null}
        </ScrollView>
      </SafeAreaView>

      {showCelebration ? <Day1Celebration /> : null}
    </View>
  )
}

/** 1500 → "1.5", 980 → "980". */
function formatKcal(kcal: number): string {
  if (kcal >= 1000) {
    return (Math.round(kcal / 100) / 10).toFixed(1)
  }
  return Math.round(kcal).toString()
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  coachLine: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    marginHorizontal: 16,
    marginTop: -8,
  },
  coachLineEm: {
    color: colors.magenta,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
    gap: 12,
  },
  weekLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.magenta,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    flex: 1,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navGlyph: {
    fontFamily: typography.displayHeavy,
    fontSize: 16,
    color: colors.bone,
    lineHeight: 16,
  },
  weekRange: {
    fontFamily: typography.displayHeavy,
    fontSize: 13,
    color: colors.leche,
    letterSpacing: -0.3,
    minWidth: 42,
    textAlign: 'center',
  },
})
