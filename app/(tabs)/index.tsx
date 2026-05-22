import * as Haptics from 'expo-haptics'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LoadingView } from '@/components/LoadingView'
import type { BriefContext } from '@/features/brief/api'
import { Day1Celebration, HomeError } from '@/features/home/components'
import { useDayRollover } from '@/features/home/useDayRollover'
import { useHomeBrief } from '@/features/home/useHomeBrief'
import { useHomeCadence, type Cadence } from '@/features/home/useHomeCadence'
import { useProfile } from '@/features/profile/hooks'
import { useRestToday, useSetRestToday } from '@/features/rest/hooks'
import { useToggleWorkoutForDate, useToggleWorkoutToday } from '@/features/streak/hooks'
import {
  CoachLine,
  DayCheckIn,
  type DayState,
  LunarConstellation,
  SectionHeader,
  SkyBackground,
  StatSlider,
  StreakLine,
  TabHeader,
  TodayMealLog,
  WeekStrip,
  type WeekDayCell,
} from '@/features/tabs/components'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import { queryKeys } from '@/lib/queryKeys'
import { colors, typography } from '@/theme'

const CELEBRATION_MS = 2000

/*
 * The commit haptic — a designed two-beat "phrase", not a tick:
 *   trained  → Medium impact ("it clicked in") + a Success
 *              notification 90 ms later ("it landed, and it mattered")
 *   backfill → a single Medium impact (marking a past day is a solid
 *              confirmation, but not today's live ritual)
 *   rested   → a soft Light impact — rest is valid, but a Success
 *              cue would mis-signal it as a "win"
 * Owned here (the action handlers) rather than in DayCheckIn or the
 * constellation, so the body's reward fires with the user's choice.
 */
function playCommitHaptic(kind: 'trained' | 'backfill' | 'rested') {
  if (kind === 'rested') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    return
  }
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  if (kind === 'trained') {
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    }, 90)
  }
}

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
      <View style={styles.screen}>
        <SkyBackground />
        <SafeAreaView style={styles.safe} edges={['top']}>
          <LoadingView />
        </SafeAreaView>
      </View>
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

  // Rest day — logged separately from workouts; it never touches the
  // constellation or the count, it only swaps the guilt-CTA for a
  // supportive message on a day the user didn't train.
  const restQuery = useRestToday(ctx.date)
  const setRest = useSetRestToday(ctx.date)
  const restedToday = restQuery.data ?? false

  const [showCelebration, setShowCelebration] = useState(false)
  const [justMarkedIdx, setJustMarkedIdx] = useState<number | null>(null)
  // The 28-day strip is the constellation's data twin — collapsed by
  // default so it doesn't compete with the hero constellation above.
  const [weekOpen, setWeekOpen] = useState(false)
  const todayIsoLocal = ctx.date

  // The week strip shows the full 28-day window as one horizontally
  // scrollable history — oldest day first, today last.
  const allDays: WeekDayCell[] = ctx.grid_28_days.map((cell) => ({
    date: cell.date,
    trained: cell.completed,
    dayNum: dayNumOf(cell.date),
    weekdayIdx: dayOfWeekOf(cell.date),
    isToday: cell.date === todayIsoLocal,
  }))

  const trainedThisMonth = ctx.grid_28_days.filter((c) => c.completed).length

  const sign = useMemo(() => zodiacFromDate(profile?.date_of_birth), [profile?.date_of_birth])
  const signLabel = ZODIAC[sign].label

  const isFirstDay = !profile?.first_workout_at && !ctx.today_workout_completed

  const greetingName = (profile?.display_name ?? '').trim().split(' ')[0] || 'tú'

  // Today's state, derived for the persistent check-in toggle. Trained
  // wins over rested if both somehow exist (a stale rest row).
  const dayState: DayState = ctx.today_workout_completed
    ? 'trained'
    : restedToday
      ? 'rested'
      : 'undecided'

  // One handler for the whole toggle. Each branch only runs on a real
  // transition (the toggle never re-fires the state it's already in),
  // so e.g. the 'trained' branch always means "newly trained".
  const handleDayChange = (next: DayState) => {
    if (next === 'trained') {
      const wasFirstDay = isFirstDay
      if (restedToday) setRest.mutate(false)
      toggleToday.mutate(true)
      playCommitHaptic('trained')
      // No flat screen wash — the reward light blooms from the
      // constellation itself (its internal radialPulse), so it
      // radiates from the figure rather than tinting the whole app.
      if (wasFirstDay) {
        setShowCelebration(true)
        setTimeout(() => {
          setShowCelebration(false)
          qc.invalidateQueries({ queryKey: queryKeys.profile.all })
        }, CELEBRATION_MS)
      }
    } else if (next === 'rested') {
      if (ctx.today_workout_completed) toggleToday.mutate(false)
      setRest.mutate(true)
      playCommitHaptic('rested')
    } else {
      // Cleared back to undecided — undo whichever was set.
      if (ctx.today_workout_completed) toggleToday.mutate(false)
      if (restedToday) setRest.mutate(false)
    }
  }

  const handleToggleDay = (date: string) => {
    const cell = ctx.grid_28_days.find((c) => c.date === date)
    if (!cell) return
    const willComplete = !cell.completed
    const idx = ctx.grid_28_days.findIndex((c) => c.date === date)
    if (idx >= 0) {
      setJustMarkedIdx(idx)
      setTimeout(() => setJustMarkedIdx(null), 800)
    }
    // Marking a past day fires the same constellation burst (which
    // re-animates on its own once the trained count rises). Undo
    // toggles stay silent — matching the constellation, which never
    // animates downward.
    if (willComplete) {
      playCommitHaptic('backfill')
    }
    toggleForDate.mutate({ date, complete: willComplete })
  }

  const enter = makeEnter(cadence)

  return (
    <View style={styles.screen}>
      <SkyBackground />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(40)}>
            <TabHeader greeting={`Hola, ${greetingName}.`} greetingEmphasis={greetingName} />
          </Animated.View>

          {/* The daily check-in — a persistent toggle. It always
              shows today's state (entrené / descansé / sin decidir)
              and stays editable; the constellation burst + filled HOY
              star still confirm a trained day alongside it. */}
          <Animated.View entering={enter(120)}>
            <DayCheckIn state={dayState} onChange={handleDayChange} />
          </Animated.View>

          {/* The streak — what the check-in puts at stake. Pops +1 on
              each commit; hides itself under 2 days. */}
          <Animated.View entering={enter(160)}>
            <StreakLine streak={ctx.streak_days} />
          </Animated.View>

          <Animated.View entering={enter(220)}>
            <SectionHeader label={`Tu ${capitalize(signLabel)}`} />
          </Animated.View>

          <Animated.View entering={enter(320)}>
            <LunarConstellation
              trained={ctx.grid_28_days.map((c) => c.completed)}
              todayIdx={27}
              sign={sign}
              committed={ctx.today_workout_completed}
            />
          </Animated.View>

          <Animated.View entering={enter(420)}>
            <CoachLine
              align="center"
              {...getCoachCopy(trainedThisMonth, signLabel, dayState === 'trained')}
            />
          </Animated.View>

          {/* "Tus 28 días" — the editable calendar twin of the
              constellation, collapsed by default. The header doubles
              as the toggle; the strip + hint reveal on tap. */}
          <Animated.View entering={enter(520)}>
            <Pressable
              onPress={() => setWeekOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: weekOpen }}
            >
              <SectionHeader
                label="Tus 28 días"
                meta={weekOpen ? 'Ocultar' : 'Ver detalle'}
                metaEmphasis={weekOpen ? 'Ocultar' : 'Ver detalle'}
              />
            </Pressable>
            {weekOpen ? (
              <Animated.View entering={FadeIn.duration(220)}>
                <Text style={styles.weekHint}>Desliza y toca un día para registrarlo.</Text>
                <WeekStrip
                  days={allDays}
                  onToggle={handleToggleDay}
                  justMarkedIdx={justMarkedIdx}
                />
              </Animated.View>
            ) : null}
          </Animated.View>

          <Animated.View entering={enter(600)}>
            <StatSlider ctx={ctx} />
          </Animated.View>

          <Animated.View entering={enter(740)}>
            <SectionHeader label="Comidas de hoy" />
          </Animated.View>
          <Animated.View entering={enter(800)}>
            <TodayMealLog
              date={ctx.date}
              onOpenMeal={(id) => router.push({ pathname: '/scan-meal', params: { editId: id } })}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {showCelebration ? <Day1Celebration /> : null}
    </View>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/* Editorial copy that follows the user through the 28-day cycle.
 * Milestone counts (1, 2, 5, 7, 10, 14, 21, 28) get unique
 * sentences; once today is marked a past-tense "done" line closes
 * the day; other in-between days draw from a per-phase POOL so two
 * consecutive logs never get the same line — a sentence that repeats verbatim every
 * day in a phase reads as a frozen screen, and a flat reward
 * habituates. The line is picked by `count % pool.length`, so it's
 * stable for a given day but rotates as the count climbs.
 *
 * The constellation centre already shows the numeric count — the
 * copy here doesn't repeat it. Sentences are capitalised so the
 * voice reads mature/editorial rather than chat-style. */
type CoachCopy = { before: string; emphasis: string; after: string }

// Phase pools — each in-between phase has several lines; consecutive
// days draw consecutive entries, so the copy keeps moving.
const COACH_PHASE_POOLS: { min: number; lines: CoachCopy[] }[] = [
  {
    min: 22,
    lines: [
      { before: '', emphasis: 'Recta final', after: '. El cielo casi se cierra.' },
      { before: 'Tu ', emphasis: 'constelación', after: ' casi está completa.' },
      { before: 'Faltan pocas estrellas para ', emphasis: 'cerrarla', after: '.' },
      { before: 'Tan cerca que ya casi lo ', emphasis: 'ves entero', after: '.' },
    ],
  },
  {
    min: 15,
    lines: [
      { before: 'Pasaste la mitad. Esto ya es ', emphasis: 'tuyo', after: '.' },
      { before: 'La segunda mitad pesa ', emphasis: 'menos', after: '. Lo notas.' },
      { before: 'Tu cielo está más ', emphasis: 'lleno que vacío', after: '.' },
      { before: 'Lo difícil ya ', emphasis: 'quedó atrás', after: '.' },
    ],
  },
  {
    min: 8,
    lines: [
      { before: 'El cuerpo aprende cuando ', emphasis: 'insistes', after: '.' },
      { before: 'Ya no es esfuerzo. Empieza a ser ', emphasis: 'tuyo', after: '.' },
      { before: 'La constancia se está volviendo ', emphasis: 'gravedad', after: '.' },
      { before: 'Tu órbita ya tiene ', emphasis: 'forma', after: '.' },
    ],
  },
  {
    min: 2,
    lines: [
      { before: 'Tu cuerpo lo está ', emphasis: 'registrando', after: '. Aunque no lo veas aún.' },
      { before: 'Dos, tres, cuatro… ', emphasis: 'un patrón', after: ' empieza a dibujarse.' },
      { before: 'Cada día suma una estrella a tu ', emphasis: 'cielo', after: '.' },
      { before: 'Todavía es frágil. Por eso ', emphasis: 'hoy importa', after: '.' },
    ],
  },
]

function getCoachCopy(count: number, signLabel: string, trainedToday: boolean): CoachCopy {
  const lower = signLabel.toLowerCase()

  // Milestone counts — landmark lines, shown whenever the count lands
  // on them. They read as achievement/closure already, so they
  // override everything below. 2 / 5 / 10 are the early-window
  // mini-milestones that flatten the post-day-1 cliff (#5).
  if (count === 28) {
    return { before: `Completaste tu ${lower}. `, emphasis: 'Brillas', after: '.' }
  }
  if (count === 21) {
    return { before: 'Tres semanas. Estás ', emphasis: 'cerca', after: '.' }
  }
  if (count === 14) {
    return { before: 'La ', emphasis: 'mitad atrás', after: '. Sigue.' }
  }
  if (count === 10) {
    return { before: 'Diez. Ya no es casualidad, es ', emphasis: 'tuyo', after: '.' }
  }
  if (count === 7) {
    return { before: 'Una semana. Tu cuerpo lo ', emphasis: 'recuerda', after: '.' }
  }
  if (count === 5) {
    return { before: 'Cinco días. Esto ya ', emphasis: 'pesa', after: '.' }
  }
  if (count === 2) {
    return { before: 'Dos. Ya empieza a ser un ', emphasis: 'patrón', after: '.' }
  }
  if (count === 1) {
    return { before: 'Hoy ', emphasis: 'empieza', after: ' algo. Tu cuerpo lo registra.' }
  }

  // Today already marked — a past-tense closing line so the screen
  // rests on "done", not "pending" (peak-end rule, #6). Rotates by
  // count so consecutive done days don't repeat.
  if (trainedToday) {
    const done: CoachCopy[] = [
      { before: 'Hoy quedó. Una estrella más en tu ', emphasis: lower, after: '.' },
      { before: 'Listo por hoy. Tu cielo ', emphasis: 'creció', after: '.' },
      { before: 'Hoy ', emphasis: 'cuenta', after: '. Tu cuerpo lo registró.' },
      { before: 'Quedó marcado. Una luz ', emphasis: 'más', after: ' en tu figura.' },
    ]
    return done[count % done.length]!
  }

  // Today still open — rotate through the matching in-progress phase
  // pool (reads as invitation, not closure).
  const phase = COACH_PHASE_POOLS.find((p) => count >= p.min)
  if (phase) {
    return phase.lines[count % phase.lines.length] ?? phase.lines[0]!
  }
  return { before: `Tu ${lower} `, emphasis: 'te espera', after: '.' }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  weekHint: {
    fontFamily: typography.ui,
    fontSize: 12,
    color: colors.niebla,
    marginTop: -4,
    marginBottom: 4,
  },
})
