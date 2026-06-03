import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import { useMacroTargets } from '@/features/macros/hooks'

import { useHasAnySignals, useSignalsHistory, useWeekSignals } from '../hooks'
import { buildArquetipoSemana } from '../mock'
import { buildVozSemanaReal, buildWeekDaysReal } from '../week-logic'
import { detectWeekPatterns } from '../week-patterns'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { PatternCard } from './PatternCard'
import { StelarVoice } from './StelarVoice'
import { WeekConstellation } from './WeekConstellation'

/*
 * The Semana segment — "Las Órbitas". Mirrors Día's anatomy: the
 * week's archetype names the seven days at once, the constellation
 * hero places them around a luminous star with today as its own
 * little orbital system inside, the DayCard adapts to whichever day
 * is selected (today by default), and the Voz de Stelar closes the
 * week with confidence + scope. MOCK content (../mock.ts).
 */
export function WeekSegment({ onOpenDia }: { onOpenDia: () => void }) {
  // The whole week is built procedurally from the real day-of-week —
  // days, archetype, counts and prose all stay in sync regardless
  // of which day the user opens the app. JS Date.getDay() returns
  // 0 for Sunday, matching the Sunday-first template layout.
  const todayIdx = useMemo(() => new Date().getDay(), [])

  // ALWAYS real — no mock. With no signals the week simply renders its
  // honest "forming" state (every day at the dim floor, the voice says
  // the week's just starting). `hasRealData` only decides whether to
  // show the "leído por Stelar" credit, never whether the data is real.
  const { data: weekSignals } = useWeekSignals()
  // Macro targets make `alimento` deficit-aware (see deriveDimensions).
  const macros = useMacroTargets()
  const calorieTarget = macros.data?.calories ?? null
  const proteinTarget = macros.data?.protein_g ?? null
  const dimCtx = useMemo(() => ({ calorieTarget, proteinTarget }), [calorieTarget, proteinTarget])
  const hasRealData = (weekSignals?.length ?? 0) > 0
  const days = useMemo(
    () => buildWeekDaysReal(weekSignals ?? [], todayIdx, dimCtx),
    [weekSignals, todayIdx, dimCtx],
  )
  const arquetipo = useMemo(() => buildArquetipoSemana(days, todayIdx), [days, todayIdx])
  const voz = useMemo(() => buildVozSemanaReal(days, todayIdx), [days, todayIdx])

  const [selectedIdx, setSelectedIdx] = useState<number>(todayIdx)
  const { data: hasAny } = useHasAnySignals()

  // Derive the state counts from the lived days so the header tells
  // the truth: in-luz today and before; lejos today and before; the
  // rest are still ahead.
  const livedCount = arquetipo.daysRead
  const daysEnLuz = arquetipo.daysEnLuz
  const porVenir = days.length - livedCount

  // The patterns are the PROTAGONIST of this altitude ("Las Órbitas —
  // las trayectorias que repites"). Real detection over ~5 weeks of
  // signals; when the history is too thin to claim anything, the list
  // shows a "still gathering" note — never mock examples.
  const { data: history } = useSignalsHistory()
  const weekPatterns = useMemo(
    () => (history ? detectWeekPatterns(history, dimCtx) : []),
    [history, dimCtx],
  )

  // Empty-state branch: hide the templated archetype + meta + voz +
  // pattern hint; render the galaxy hero with all 7 days as ghosts
  // (the WeekConstellation handles brightness=0 gracefully).
  if (hasAny === false) {
    const ghostDays = days.map((d) => ({
      ...d,
      brightness: 0,
      archetype: '',
      dimEnLuz: 0,
      drift: 0,
      note: 'Aún no hay registros.',
    }))
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <View style={styles.header}>
          <EmText
            text="tu primera semana"
            emphasis="primera semana"
            style={styles.archetype}
            emStyle={styles.archetypeEm}
          />
        </View>
        <View style={styles.diagram}>
          <WeekConstellation
            days={ghostDays}
            selectedIdx={todayIdx}
            onSelect={() => {}}
            onOpenDia={onOpenDia}
          />
        </View>
        <EmptySegmentCard
          eyebrow="La galaxia se enciende con la data"
          body="Por ahora todos los días están en silencio. Registra desde Hoy y los días brillan según lo que pasó."
          hint="Stelar arma la prosa de la semana cuando tenga al menos un día con señales."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Compressed header — archetype as the only hero, then a single
          dense meta block that names the week's state, who read it
          and the insight. No eyebrow on top: the tab pill already
          says "Semana". */}
      <View style={styles.header}>
        {/* Frames the week's archetype as a lens, not an identity. */}
        <Text style={styles.lensEyebrow}>Tu lente de la semana</Text>
        <EmText
          text={arquetipo.name}
          emphasis={arquetipo.emphasis}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        <View style={styles.metaRow}>
          <LiveDot />
          <Text style={styles.meta} numberOfLines={hasRealData ? 2 : 1}>
            {/* Leads with the light — days "lejos" aren't tallied. */}
            <Text style={styles.metaNum}>{daysEnLuz}</Text>
            <Text> en luz · </Text>
            <Text style={styles.metaNum}>{porVenir}</Text>
            <Text> por venir</Text>
            {/* "leído por Stelar · N días" — shown once the week is read
                from real signals (Stelar reads them deterministically). */}
            {hasRealData ? (
              <>
                <Text style={styles.metaSep}>{'\n'}</Text>
                <Text>leído por </Text>
                <Text style={styles.metaStelar}>Stelar</Text>
                <Text>{` · ${arquetipo.daysRead} días`}</Text>
              </>
            ) : null}
          </Text>
        </View>
      </View>

      {/* Compact week-at-a-glance — the seven-day constellation,
          demoted from full-bleed hero to a smaller glance up top.
          The week's REAL subject (the patterns) lives below; this
          diagram now just sets the scene. Tapping a halo still opens
          its HaloBubble with the day's info. */}
      <View style={styles.diagram}>
        <WeekConstellation
          days={days}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          onOpenDia={onOpenDia}
        />
      </View>

      {/* Stelar's reading of the week so far. The tag flips to
          "Cierre de semana" once the week is done; mid-week it
          stays "Hasta ahora". */}
      <StelarVoice
        parts={voz.parts}
        tag={todayIdx === 6 ? 'Cierre de semana' : 'Hasta ahora'}
        // The confidence signature ("Confianza alta · N días") rides the
        // real reading only — never shown over the mock example prose.
        signature={hasRealData ? voz.signature : undefined}
      />

      {/* The patterns — the protagonist of "Las Órbitas". Real detections
          over the rolling history; tapping opens the detail. When there
          isn't enough yet, an honest "still gathering" note — never mock. */}
      <View style={styles.patterns}>
        <Text style={styles.patternsEyebrow}>Las órbitas que repites</Text>
        {weekPatterns.length > 0 ? (
          weekPatterns.map((p) => <PatternCard key={p.id} patron={p} />)
        ) : (
          <EmptySegmentCard
            eyebrow="Stelar está reuniendo tus semanas"
            body="Los patrones se revelan cuando hay suficiente para cruzar. Cada día que registras acerca el primero."
          />
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  // ── Header — compressed, archetype as the only hero ──────────
  header: {
    alignItems: 'center',
  },
  // Frames the archetype as a passing lens, not an identity.
  lensEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 8,
  },
  archetype: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 27,
    lineHeight: 32,
    color: colors.leche,
    textAlign: 'center',
  },
  archetypeEm: {
    color: colors.magenta,
  },
  metaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    lineHeight: 16,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
  },
  metaNum: {
    color: colors.magenta,
  },
  metaStelar: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.magenta,
  },
  metaSep: {
    fontSize: 4,
  },
  // ── Diagram — compact glance, centred (was full-bleed hero) ───
  diagram: {
    width: '72%',
    alignSelf: 'center',
    marginTop: 10,
  },
  // ── Patterns — the protagonist list ──────────────────────────
  patterns: {
    marginTop: 24,
  },
  patternsEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 2,
    marginLeft: 2,
  },
})
