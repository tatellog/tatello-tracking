import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { useSeenMesTapHint } from '@/lib/onboardingFlags'
import { colors, typography } from '@/theme'

import { useMacroTargets } from '@/features/macros/hooks'

import { useHasAnySignals, useSignalsHistory } from '../hooks'
import { useDailyIntelligence } from '../useDailyIntelligence'
import {
  buildMonthSatellites,
  buildMonthSummary,
  buildVozMes,
  monthDaysLogged,
  monthTheme,
  type DimensionMonth,
} from '../month-logic'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { MonthSky, type Satellite } from './MonthSky'
import { PatternCard } from './PatternCard'
import { StelarVoice } from './StelarVoice'

/*
 * The Mes segment — "El Cielo". The ARC OF THE MONTH: how each of the six
 * dimensions moved over ~30 days (its month level + its trend), a written
 * month reading, on a calm cosmos hero. NOT a menstrual-cycle tracker —
 * the cycle only feeds the `ciclo` dimension as one signal among six
 * (docs/tu-orbita-design.md §7). All REAL + deterministic from
 * daily_signals; no mock. The AI engine later enriches the prose.
 */
export function MonthSegment() {
  const { data: hasAny } = useHasAnySignals()
  const { data: history } = useSignalsHistory(30)
  // Macro targets make `alimento` deficit-aware (see deriveDimensions).
  const macros = useMacroTargets()
  const dimCtx = useMemo(
    () => ({
      calorieTarget: macros.data?.calories ?? null,
      proteinTarget: macros.data?.protein_g ?? null,
    }),
    [macros.data?.calories, macros.data?.protein_g],
  )

  const signals = useMemo(() => history ?? [], [history])
  const summary = useMemo(() => buildMonthSummary(signals, dimCtx), [signals, dimCtx])
  const daysLogged = monthDaysLogged(signals)
  const theme = monthTheme(summary, daysLogged)
  const voz = useMemo(() => buildVozMes(summary, daysLogged), [summary, daysLogged])
  const hasRealData = daysLogged > 0
  // Month patterns — the month-shape habits ("Tu semana de movimiento",
  // "…tiene una forma") followed by the day recurrences ("todos los lunes…",
  // "los sábados…", "las noches…"). From the BACKEND engine (daily-
  // intelligence Edge Function); falls back to the same local rules.
  const intel = useDailyIntelligence()
  const monthPatterns = intel.data?.month.patterns ?? []

  // The month's headline satellites + their tap-reveal. The named bodies
  // (tu brillo / tu ancla / tu calma / stelar observa) orbit the hero;
  // tapping one reveals the real dimension behind the poetic name.
  const monthSats = useMemo(() => buildMonthSatellites(summary, daysLogged), [summary, daysLogged])
  const [selectedSatId, setSelectedSatId] = useState<string | null>(null)
  // One-time "toca un astro" hint — shown until the user taps a satellite.
  const [seenTapHint, markTapHint] = useSeenMesTapHint()
  const handleSelectSat = (id: string) => {
    setSelectedSatId(id)
    if (!seenTapHint) markTapHint()
  }
  const satellites = useMemo<Satellite[]>(
    () =>
      monthSats.map((s) => ({
        id: s.id,
        label: s.label,
        kind: s.kind,
        dimensionKey: s.dimensionKey,
        selected: s.id === selectedSatId,
      })),
    [monthSats, selectedSatId],
  )
  const selectedSat = selectedSatId ? monthSats.find((s) => s.id === selectedSatId) : null

  // Never logged anything yet → dedicated first-run state.
  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <View style={styles.header}>
          <EmText
            text="tu primer mes"
            emphasis="primer mes"
            style={styles.archetype}
            emStyle={styles.archetypeEm}
          />
        </View>
        <View style={styles.diagram}>
          <MonthSky satellites={[]} onSatellitePress={undefined} />
        </View>
        <EmptySegmentCard
          eyebrow="El cielo se forma día a día"
          body="Stelar no inventa nada. Necesita verte primero: registra desde Hoy y el mes se va dibujando."
          hint="Con unos días de señales, el arco de tu mes empieza a leerse."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <View style={styles.header}>
        <EmText
          text={`tu mes en ${theme}`}
          emphasis={theme}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        <View style={styles.metaRow}>
          <LiveDot />
          <Text style={styles.meta} numberOfLines={1}>
            <Text style={styles.metaNum}>{daysLogged}</Text>
            <Text> días con señales</Text>
            {hasRealData ? (
              <>
                <Text> · leído por </Text>
                <Text style={styles.metaStelar}>Stelar</Text>
              </>
            ) : null}
          </Text>
        </View>
      </View>

      {/* Cosmos hero with the month's headline satellites. Tapping a
          named body reveals the real dimension behind it. */}
      <View style={styles.diagram}>
        <MonthSky
          satellites={satellites}
          onSatellitePress={handleSelectSat}
          selectedSatelliteId={selectedSatId}
          evidence={
            selectedSat
              ? {
                  label: selectedSat.label,
                  caption: selectedSat.caption,
                  detail: selectedSat.detail,
                  tentative: selectedSat.tentative,
                }
              : null
          }
          onCloseSatellite={() => setSelectedSatId(null)}
        />
      </View>

      {/* One-time discovery hint — the chain isn't obviously tappable, so
          a discreet cue invites the first tap, then never shows again. */}
      {!seenTapHint && !selectedSatId && satellites.length > 0 ? (
        <Animated.Text entering={FadeIn.duration(600).delay(400)} style={styles.tapHint}>
          Toca un astro para ver su lectura
        </Animated.Text>
      ) : null}

      {/* The arc of the month — how each dimension moved. The heart of
          this altitude. */}
      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Cómo se movió tu mes</Text>
        <MonthDimensionSummary summary={summary} />
      </View>

      <StelarVoice
        parts={voz.parts}
        tag="Este mes"
        signature={hasRealData ? voz.signature : undefined}
      />

      {/* Tus patrones del mes — the recurrences that need several weeks to
          be real ("todos los lunes…", "los sábados…") + the month-shape
          habits. Hidden until they clear. */}
      {monthPatterns.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Tus patrones del mes</Text>
          {monthPatterns.map((p) => (
            <PatternCard key={p.id} patron={p} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  )
}

const TREND_GLYPH: Record<DimensionMonth['trend'], string> = { up: '↑', down: '↓', flat: '·' }

/* Six rows — one per dimension — each a month-average level bar + a
 * trend mark (rose where it's moving, quiet where it's flat). */
function MonthDimensionSummary({ summary }: { summary: readonly DimensionMonth[] }) {
  return (
    <View style={styles.list}>
      {summary.map((d) => (
        <View key={d.key} style={styles.row}>
          <Text style={styles.dimLabel}>{d.label}</Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(d.avg * 100)}%`, backgroundColor: colors.dimension[d.key] },
              ]}
            />
          </View>
          <Text
            style={[
              styles.trend,
              d.trend === 'up'
                ? styles.trendUp
                : d.trend === 'down'
                  ? styles.trendDown
                  : styles.trendFlat,
            ]}
          >
            {TREND_GLYPH[d.trend]}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  header: {
    alignItems: 'center',
  },
  archetype: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.displaySm,
    lineHeight: 28,
    color: colors.leche,
    textAlign: 'center',
  },
  archetypeEm: {
    color: colors.magenta,
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
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
    textTransform: 'none',
  },
  // Cosmos hero — wider than the Week glance so the satellite chain on
  // the right has air for its labels, but not full-bleed (the bars below
  // are the detail layer).
  diagram: {
    width: '88%',
    alignSelf: 'center',
    marginTop: 8,
  },
  // Discreet discovery cue under the cosmos — observatory chrome (niebla,
  // uppercase), never magenta, fades out for good after the first tap.
  tapHint: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    opacity: 0.85,
  },
  section: {
    marginTop: 22,
  },
  sectionEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
    marginBottom: 12,
    marginLeft: 2,
  },
  list: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dimLabel: {
    width: 78,
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.leche,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(244,236,222,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  trend: {
    width: 18,
    textAlign: 'center',
    fontFamily: typography.uiBold,
    fontSize: 15,
  },
  trendUp: {
    color: colors.magenta,
  },
  trendDown: {
    color: colors.niebla,
  },
  trendFlat: {
    color: colors.bruma,
  },
})
