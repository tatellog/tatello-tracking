import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import { useMacroTargets } from '@/features/macros/hooks'

import { useHasAnySignals, useWeekSignals } from '../hooks'
import { buildArquetipoSemana } from '../mock'
import { useDailyIntelligence } from '../useDailyIntelligence'
import {
  buildVozSemanaReal,
  buildWeekDaysReal,
  buildWeekObservations,
  buildWeekRecap,
} from '../week-logic'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { StelarVoice } from './StelarVoice'
import { WeekConstellation } from './WeekConstellation'
import { ObservationCard } from './ObservationCard'
import { LuzStar, RecapDust, SectionDivider } from './WeekRecapArt'

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

  // "Esta semana, en números" — this week's log totals, computed locally
  // from the same shared rules (the Día/Mes engine lives in the BE; this
  // recap is a pure read over the week's signals).
  const recap = useMemo(() => buildWeekRecap(weekSignals ?? [], todayIdx), [weekSignals, todayIdx])
  // Within-week micro-observations ("el lunes y el miércoles tu comida pasó
  // tu objetivo") — day-named facts of THIS week, deficit-aware via dimCtx.
  const observations = useMemo(
    () => buildWeekObservations(weekSignals ?? [], todayIdx, dimCtx),
    [weekSignals, todayIdx, dimCtx],
  )

  // The "lo que viene" nudge comes from the BACKEND engine (daily-intelligence
  // Edge Function); the hook falls back to the same local rules if it's
  // unreachable. The month-shape patterns moved to Mes (they read the month).
  const intel = useDailyIntelligence()
  const remaining = 6 - todayIdx // days still ahead this Sunday-first week
  const weekAhead = intel.data?.week.ahead ?? null

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

      {/* Esta semana, en números — the four log counts in a 2×2, with "días
          en luz" pulled out below as a quality read (not a raw count). The
          card sits in the observatory's light (oro): a faint star-dust wash,
          an oro hairline, the tiles igniting in a soft cascade. Honest:
          sleep/water recede to "—" when nothing's logged, never a 0. */}
      <View style={styles.recap}>
        <Text style={styles.recapEyebrow}>Esta semana, en números</Text>
        <View style={styles.recapCard}>
          <RecapDust />
          <View style={styles.recapGrid}>
            <Stat index={0} value={String(recap.entrenos)} label="Entrenos" />
            <Stat
              index={1}
              value={recap.sleepAvgMin != null ? (recap.sleepAvgMin / 60).toFixed(1) : '—'}
              unit={recap.sleepAvgMin != null ? 'h' : undefined}
              label="Sueño prom."
              empty={recap.sleepAvgMin == null}
            />
            <Stat index={2} value={String(recap.meals)} label="Comidas" />
            <Stat
              index={3}
              value={recap.waterAvg != null ? String(recap.waterAvg) : '—'}
              unit={recap.waterAvg != null ? 'vasos' : undefined}
              label="Agua prom."
              empty={recap.waterAvg == null}
            />
          </View>
          {/* Días en luz — a quality read, the recap's one selective glow. */}
          <View style={styles.luzRow}>
            <LuzStar />
            <Text style={styles.luzText}>
              <Text style={styles.luzNum}>{daysEnLuz}</Text>
              <Text>{` de tus ${livedCount} ${livedCount === 1 ? 'día' : 'días'}, en luz`}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Lo que noté esta semana — within-week micro-observations. Each is a
          catalogued star: a WIN burns in its dimension's color (haloed), a
          WATCH in oro (no halo, never red). The eyebrow goes oro — this is
          Stelar's read, the differentiator, lifted above the gray chrome. */}
      {observations.length > 0 ? (
        <>
          <SectionDivider />
          <View style={styles.obs}>
            <Text style={styles.obsEyebrowLit}>Lo que noté esta semana</Text>
            {observations.map((o, i) => (
              <Animated.View key={o.key} entering={FadeIn.duration(420).delay(i * 90)}>
                <ObservationCard obs={o} />
              </Animated.View>
            ))}
          </View>
        </>
      ) : null}

      <SectionDivider />

      {/* Lo que viene — the days still ahead this week + a knowing nudge
          from the Mes patterns (only when a patterned day is still ahead). */}
      <View style={styles.ahead}>
        <Text style={styles.aheadEyebrow}>Lo que viene</Text>
        <Text style={styles.aheadDays}>
          {remaining <= 0
            ? 'Tu semana cierra hoy.'
            : remaining === 1
              ? 'Te queda 1 día esta semana.'
              : `Te quedan ${remaining} días esta semana.`}
        </Text>
        {weekAhead ? <Text style={styles.aheadHint}>{weekAhead}</Text> : null}
      </View>
    </Animated.View>
  )
}

/* One recap tile (half-width, 2×2) — a datum over a quiet label, igniting
 * in a soft cascade. An empty metric ("—") recedes to bruma so what's real
 * keeps the light. The optional unit rides small next to the value. */
function Stat({
  index,
  value,
  unit,
  label,
  empty,
}: {
  index: number
  value: string
  unit?: string
  label: string
  empty?: boolean
}) {
  return (
    <Animated.View entering={FadeIn.duration(380).delay(index * 80)} style={styles.stat}>
      <Text style={[styles.statValue, empty ? styles.statValueEmpty : null]}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  // ── Esta semana, en números — the recap stat grid ──────────────
  recap: {
    marginTop: 24,
  },
  recapEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
  },
  // The card — in the observatory's light: oro hairline, star-dust wash
  // behind (overflow-hidden clips it to the rounded corners).
  recapCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  recapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    width: '50%',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  statValue: {
    fontFamily: typography.uiBold,
    fontSize: 24,
    color: colors.leche,
  },
  statValueEmpty: {
    color: colors.bruma,
  },
  statUnit: {
    fontFamily: typography.uiMedium,
    fontSize: 12,
    color: colors.niebla,
  },
  statLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginTop: 4,
  },
  // Días en luz — its own line below the grid, divided by an oro hairline.
  luzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 2,
    marginHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.oroHairlineSoft,
  },
  luzText: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.bone,
  },
  luzNum: {
    color: colors.oroLight,
  },
  // ── Lo que noté esta semana — the micro-observation list ───────
  obs: {},
  // The differentiator's eyebrow — oro, lifted above the gray chrome.
  obsEyebrowLit: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.oro,
    marginBottom: 14,
    marginLeft: 2,
  },
  // ── Lo que viene — a quiet footnote, separated by a cosmic divider. ──
  ahead: {},
  aheadEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 8,
  },
  aheadDays: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  aheadHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginTop: 6,
  },
})
