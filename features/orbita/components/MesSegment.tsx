import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { ENGINE_ACTIVE } from '../engine'
import { useHasAnySignals } from '../hooks'
import {
  buildFirstCycleVoz,
  MOCK_CICLO,
  MOCK_OBSERVATIONS,
  MOCK_PATRONES,
  MOCK_VOZ,
  type Observation,
  type Patron,
} from '../mock'
import { EmptySegmentCard } from './EmptySegmentCard'
import { LiveDot } from './LiveDot'
import { ObservationChart } from './ObservationChart'
import { PreviewBanner } from './PreviewBanner'
import { TuCielo, type Satellite } from './TuCielo'
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
  const ciclo = MOCK_CICLO
  const isFirstCycle = ciclo.cycleNumber === 1
  const remaining = Math.max(0, ciclo.length - ciclo.day)
  const { data: hasAny } = useHasAnySignals()

  // Cycle-1 only: which observation the user has tapped open. Default
  // to the peak so the chart shows on first paint — the gesture
  // (tap satellites to switch) is then learned by exploration.
  // Tap the same satellite again to close. Mature cycles navigate
  // away on tap so this state stays null in that branch.
  const [selectedObsId, setSelectedObsId] = useState<string | null>(() =>
    isFirstCycle ? (MOCK_OBSERVATIONS[0]?.id ?? null) : null,
  )
  const selectedObs = selectedObsId
    ? (MOCK_OBSERVATIONS.find((o) => o.id === selectedObsId) ?? null)
    : null

  // Tap handler:
  //  · cycle 1 → toggle inline readout for the observation
  //  · cycle 3+ → navigate to the existing pattern detail screen
  const handleSatellitePress = useCallback(
    (id: string) => {
      if (isFirstCycle) {
        setSelectedObsId((prev) => (prev === id ? null : id))
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
    () => (isFirstCycle ? buildFirstCycleVoz(ciclo, MOCK_OBSERVATIONS) : null),
    [isFirstCycle, ciclo],
  )

  // Header archetype: "tu primer ciclo en X" in cycle 1, "tu ciclo
  // en X" thereafter — the "primer" marker is its own honesty.
  const archetypeName = isFirstCycle
    ? `tu primer ciclo en ${ciclo.phase.toLowerCase()}`
    : `tu ciclo en ${ciclo.phase.toLowerCase()}`
  const archetypeEmphasis = ciclo.phase.toLowerCase()

  // Empty-state branch: hide the satellites + readout + voz. The BH
  // hero still renders (visual identity of Mes) but with empty
  // satellites so the eye doesn't see fake patterns yet.
  if (hasAny === false) {
    return (
      <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
        <View style={styles.header}>
          <EmText
            text="tu primer ciclo"
            emphasis="primer ciclo"
            style={styles.archetype}
            emStyle={styles.archetypeEm}
          />
        </View>
        <View style={styles.diagram}>
          <TuCielo ciclo={ciclo} satellites={[]} onSatellitePress={undefined} />
        </View>
        <EmptySegmentCard
          eyebrow="El cielo se forma día a día"
          body="Stelar no inventa patrones. Necesita verte primero — al menos un día con algo registrado."
          hint="A partir del segundo ciclo, Stelar empieza a confirmar lo que se repite."
        />
      </Animated.View>
    )
  }

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      {/* Honest framing while the engine is mock. */}
      {ENGINE_ACTIVE ? null : <PreviewBanner />}

      {/* Compressed header — mirrors Día / Semana. */}
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
            <Text style={styles.metaNum}>{ciclo.day}</Text>
            <Text>{` de ${ciclo.length} · `}</Text>
            <Text style={styles.metaNum}>{remaining}</Text>
            <Text> por cerrar</Text>
            {isFirstCycle ? (
              <>
                <Text> · </Text>
                <Text style={styles.metaQuiet}>primera lectura</Text>
              </>
            ) : (
              <>
                <Text> · </Text>
                <Text style={styles.metaNum}>{ciclo.patternsConfirmed}</Text>
                <Text> patrones</Text>
              </>
            )}
          </Text>
        </View>
      </View>

      {/* The hero — same visual for both cycles, fed differently. */}
      <View style={styles.diagram}>
        <TuCielo ciclo={ciclo} satellites={satellites} onSatellitePress={handleSatellitePress} />
      </View>

      {/* Cycle-1 readout: when the user taps an observation, its
          meaning lands here, mirroring Día's selected-dimension
          flow. Re-mounts on selection change so it fades in. */}
      {selectedObs ? (
        <Animated.View key={selectedObs.id} entering={FadeIn.duration(220)}>
          <ObservationReadout observation={selectedObs} />
        </Animated.View>
      ) : isFirstCycle ? (
        <Text style={styles.hint}>Toca una observación para leerla.</Text>
      ) : null}

      {/* Voz — first-cycle honest version OR mature paragraph. */}
      {voz ? (
        <VozDeStelar scope="primera lectura" parts={voz.parts} />
      ) : (
        <VozDeStelar scope="este ciclo" text={MOCK_VOZ.mes} />
      )}
    </Animated.View>
  )
}

/* The inline readout for a tapped observation. Renders the
 * mini-chart (the dynamic evidence), the satellite's label in the
 * eyebrow, and the full sentence in coach voice. Tentative
 * observations get an extra micro-line at the end naming the wait
 * so the user understands why it's not being treated as a
 * confirmed pattern yet. */
function ObservationReadout({ observation }: { observation: Observation }) {
  return (
    <View style={styles.readoutCard}>
      <EyebrowLabel tone="magenta" size={10}>
        {observation.label}
      </EyebrowLabel>
      <View style={styles.readoutChart}>
        <ObservationChart chart={observation.chart} />
      </View>
      <Text style={styles.readoutBody}>{observation.detail}</Text>
      {observation.tentative ? (
        <Text style={styles.readoutHint}>
          Stelar lo marca como observación. Para llamarlo patrón necesita verlo al menos otra vez.
        </Text>
      ) : null}
    </View>
  )
}

function observationToSatellite(o: Observation): Satellite {
  return { id: o.id, label: o.label, tentative: o.tentative }
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
  // ── Cycle-1 readout (tapped observation) ────────────────────
  readoutCard: {
    marginTop: 18,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readoutChart: {
    marginTop: 12,
    alignItems: 'center',
  },
  readoutBody: {
    marginTop: 12,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: colors.leche,
  },
  readoutHint: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.niebla,
  },
  // Hint when nothing is selected yet — mirrors Día's quiet
  // "Toca una dimensión para leerla."
  hint: {
    marginTop: 18,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.niebla,
    textAlign: 'center',
  },
})
