import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import { ENGINE_ACTIVE } from '../engine'
import { useHasAnySignals } from '../hooks'
import {
  buildFirstCycleVoz,
  MOCK_CYCLE,
  MOCK_OBSERVATIONS,
  MOCK_PATRONES,
  MOCK_VOZ,
  type Observation,
  type Patron,
} from '../mock'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { PreviewBanner } from './PreviewBanner'
import { TuCielo, type Satellite, type SatelliteKind } from './TuCielo'
import { VozDeStelar } from './VozDeStelar'

/*
 * The Mes segment — "El Cielo". Single visual hero (TuCielo) +
 * Voz de Stelar + (mature only) one experimento. The view splits
 * into two clear surfaces based on cycle history:
 *
 *  Cycle 1 (no replication possible yet):
 *    · Satellites carry OBSERVATIONS, not patterns. Decorative —
 *      no tap navigation. The fourth slot is a tentative hint
 *      marked visually as "stelar observa" — dimmer than the rest.
 *    · Voz is honest about the learning state and quotes the
 *      observed peak day.
 *    · A "Stelar está leyendo" card sets expectations: confirmed
 *      patterns arrive in cycle 2.
 *    · No experimento card (no statistical basis for one).
 *
 *  Cycle 3+ (mature):
 *    · Satellites carry confirmed Patrones. Tap → detail screen.
 *    · Voz cites anchor + gravity patterns.
 *    · Experimento card surfaces the cycle's single proposed shift.
 *
 *  Cycle 2 (transition, future work):
 *    · Tentative satellites with low-confidence flag, blended with
 *      observations. Not implemented yet — falls back to mature
 *      view shape but with reduced claims.
 *
 * Content is MOCK (../mock.ts); the inference engine will fill in.
 */
export function MesSegment() {
  const router = useRouter()
  const cycle = MOCK_CYCLE
  const isFirstCycle = cycle.cycleNumber === 1
  const { data: hasAny } = useHasAnySignals()

  // Cycle-1: which observation is currently summoned. Default is
  // null — the hero opens with a clean cosmos; the user invokes a
  // pattern by tapping a chain item. Tapping the backdrop (outside
  // the chain) closes the summon and returns to the cosmos view.
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null)
  const selectedObs = selectedObsId
    ? (MOCK_OBSERVATIONS.find((o) => o.id === selectedObsId) ?? null)
    : null

  // Tap handler:
  //  · cycle 1 → switch the readout to that observation (no toggle)
  //  · cycle 3+ → navigate to the existing pattern detail screen
  const handleSatellitePress = useCallback(
    (id: string) => {
      if (isFirstCycle) {
        setSelectedObsId(id)
      } else {
        router.push(`/orbita/patron/${id}`)
      }
    },
    [isFirstCycle, router],
  )

  // Build satellites; the `selected` flag highlights whichever one
  // matches the open observation so the user can trace label → body.
  const satellites = useMemo(() => {
    if (isFirstCycle) {
      return MOCK_OBSERVATIONS.map((o) => ({
        ...observationToSatellite(o),
        selected: o.id === selectedObsId,
      }))
    }
    return MOCK_PATRONES.slice(0, 4).map(patronToSatellite)
  }, [isFirstCycle, selectedObsId])

  // Voz: first-cycle prose with honest scope, or mature reading.
  const voz = useMemo(
    () => (isFirstCycle ? buildFirstCycleVoz(cycle, MOCK_OBSERVATIONS) : null),
    [isFirstCycle, cycle],
  )

  // Header archetype — "tu primer mes en {phase}" / "tu mes en
  // {phase}". The phase value here is a data-derived theme (e.g.
  // "lectura", "ritmo bajo", "ascenso"), NOT a menstrual cycle
  // phase — this segment reads monthly behaviour patterns.
  const archetypeName = isFirstCycle
    ? `tu primer mes en ${cycle.phase.toLowerCase()}`
    : `tu mes en ${cycle.phase.toLowerCase()}`
  const archetypeEmphasis = cycle.phase.toLowerCase()

  // Empty-state branch: hide the satellites + readout + voz. The BH
  // hero still renders (visual identity of Mes) but with empty
  // satellites so the eye doesn't see fake patterns yet.
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
          <TuCielo satellites={[]} onSatellitePress={undefined} />
        </View>
        <EmptySegmentCard
          eyebrow="El cielo se forma día a día"
          body="Stelar no inventa patrones. Necesita verte primero — al menos un día con algo registrado."
          hint="A partir del segundo mes, Stelar empieza a confirmar lo que se repite."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Honest framing while the engine is mock. */}
      {ENGINE_ACTIVE ? null : <PreviewBanner />}

      {/* Tighter header — title + inline status, no separate
          eyebrow + meta row. Saves ~40 px vertical and gives the
          hero more presence. */}
      <View style={styles.header}>
        <EmText
          text={archetypeName}
          emphasis={archetypeEmphasis}
          style={styles.archetype}
          emStyle={styles.archetypeEm}
        />
        <View style={styles.metaRow}>
          <LiveDot />
          <Text style={styles.meta} numberOfLines={1}>
            <Text>Día </Text>
            <Text style={styles.metaNum}>{cycle.day}</Text>
            <Text> · </Text>
            {isFirstCycle ? (
              <Text style={styles.metaQuiet}>primera lectura</Text>
            ) : (
              <>
                <Text style={styles.metaNum}>{cycle.patternsConfirmed}</Text>
                <Text> patrones</Text>
              </>
            )}
          </Text>
        </View>
      </View>

      {/* The hero — BH cosmos + pattern chain. Tapping a chain
          item lights up the days in the cosmos where Stelar
          detected that pattern, plus a one-line caption beneath
          the BH. The cosmos itself becomes the readout — no
          separate card below. Mature cycles navigate away. */}
      <View style={styles.diagram}>
        <TuCielo
          satellites={satellites}
          onSatellitePress={handleSatellitePress}
          selectedSatelliteId={isFirstCycle ? selectedObsId : null}
          evidence={
            isFirstCycle && selectedObs
              ? {
                  label: selectedObs.label,
                  caption: selectedObs.caption,
                  detail: selectedObs.detail,
                  tentative: selectedObs.tentative,
                }
              : null
          }
          onCloseSatellite={() => setSelectedObsId(null)}
        />
      </View>

      {/* Voz — first-cycle honest version OR mature paragraph. */}
      {voz ? (
        <VozDeStelar scope="primera lectura" parts={voz.parts} />
      ) : (
        <VozDeStelar scope="este mes" text={MOCK_VOZ.mes} />
      )}
    </Animated.View>
  )
}

function observationToSatellite(o: Observation): Satellite {
  // `kind` is the single visual-treatment knob: tentative wins
  // (dashed halo) regardless of slot; otherwise the observation
  // id picks one of peak / valley / stable.
  const kind: SatelliteKind = o.tentative
    ? 'tentative'
    : o.id === 'peak'
      ? 'peak'
      : o.id === 'valley'
        ? 'valley'
        : 'stable'
  return { id: o.id, label: o.label, kind }
}

function patronToSatellite(p: Patron): Satellite {
  const label =
    p.data.kind === 'weekday'
      ? (['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][p.data.focus] ??
        p.emphasis)
      : p.data.kind === 'cycle'
        ? `día ${p.data.markDay}`
        : p.emphasis
  return { id: p.id, label }
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
    fontSize: 24,
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
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
    textAlign: 'center',
  },
  metaNum: {
    color: colors.magenta,
  },
  metaQuiet: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 12,
    color: colors.bone,
    textTransform: 'none',
    letterSpacing: 0,
  },
  diagram: {
    marginHorizontal: -20,
    marginTop: 4,
  },
})
