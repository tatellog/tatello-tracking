import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import { ENGINE_ACTIVE } from '../engine'
import { useHasAnySignals } from '../hooks'
import { buildArquetipoSemana, buildVozSemana, buildWeekDays, MOCK_PATRONES } from '../mock'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { PatternHint } from './PatternHint'
import { PreviewBanner } from './PreviewBanner'
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
  const days = useMemo(() => buildWeekDays(todayIdx), [todayIdx])
  const arquetipo = useMemo(() => buildArquetipoSemana(days, todayIdx), [days, todayIdx])
  const voz = useMemo(() => buildVozSemana(days, todayIdx), [days, todayIdx])

  const [selectedIdx, setSelectedIdx] = useState<number>(todayIdx)
  const { data: hasAny } = useHasAnySignals()

  // Derive the state counts from the lived days so the header tells
  // the truth: in-luz today and before; lejos today and before; the
  // rest are still ahead.
  const livedCount = arquetipo.daysRead
  const daysEnLuz = arquetipo.daysEnLuz
  const porVenir = days.length - livedCount

  const activePattern = pickActivePattern(todayIdx)

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
      {/* Honest framing while the engine is mock. */}
      {ENGINE_ACTIVE ? null : <PreviewBanner />}

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
          <Text style={styles.meta} numberOfLines={ENGINE_ACTIVE ? 2 : 1}>
            {/* Leads with the light — days "lejos" aren't tallied. */}
            <Text style={styles.metaNum}>{daysEnLuz}</Text>
            <Text> en luz · </Text>
            <Text style={styles.metaNum}>{porVenir}</Text>
            <Text> por venir</Text>
            {/* "leído por Stelar · N días" — only true once the engine
                has run; hidden while the week's prose is mock. */}
            {ENGINE_ACTIVE ? (
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

      {/* Full-bleed hero — the constellation of the seven days.
          Tapping a halo opens a small HaloBubble anchored to that
          star, carrying the day's info + (today only) the "Abrir
          Día" CTA. There is no separate card below: the
          constellation IS the UI. */}
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
        // The confidence signature ("Confianza alta · N días") is a
        // real-engine artifact — never shown over mock prose.
        signature={ENGINE_ACTIVE ? voz.signature : undefined}
      />

      {/* One pattern surfaced here as a doorway — the full list lives
          in Mes, where the cross-week scope belongs. We pick the
          forward-looking pattern (its focus day still ahead this
          week) so the chip is actionable, not retrospective. */}
      {activePattern ? <PatternHint patron={activePattern} /> : null}
    </Animated.View>
  )
}

/* Pick the pattern most worth surfacing in Semana right now. We
 * prefer a weekday pattern whose focus is still ahead (so the hint
 * is actionable), falling back to the first available. */
function pickActivePattern(todayIdx: number) {
  // buildWeekDays is Sunday-first; PatternCard's weekday glyph is
  // Monday-first (L=0..D=6). Convert today's idx accordingly.
  const monFirst = (todayIdx + 6) % 7
  const upcoming = MOCK_PATRONES.find((p) => p.data.kind === 'weekday' && p.data.focus > monFirst)
  return upcoming ?? MOCK_PATRONES[0] ?? null
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
    fontSize: 10,
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
  // ── Diagram, full-bleed ───────────────────────────────────────
  diagram: {
    marginHorizontal: -20,
    marginTop: 4,
  },
})
