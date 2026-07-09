import { useState } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import type { Finding } from '../findings'
import { constellationAccent, FindingConstellation } from './finding-constellations'
import { InsightChart } from './InsightCharts'

/*
 * MonthReport — el REPORTE DE EVIDENCIA de Órbita Mes (determinístico, cero IA,
 * cero relleno). La DB es cuadrada y ve lo que la memoria no; aquí devuelve los
 * HECHOS del mes, de arriba a abajo:
 *
 *   VEREDICTO      ¿vas bien? anclado en déficit sostenido (no en la balanza).
 *   DÓNDE SE TE VA los obstáculos invisibles (rompes la dieta / te frena el gym),
 *                  con el número y el CONTRAPUNTO ("¿y los días que no?").
 *   LO QUE SOSTIENE las palancas positivas (opcional).
 *   PUERTA ABIERTA cierre que no desanima.
 *
 * Números en Hanken (voz de dato), nunca poesía. La única voz cálida (Cormorant
 * italic) es el cierre. Cada hecho abre "ver esos días" y lleva a profundizar.
 */

type Props = {
  cards: Finding[]
  /** Toca un hecho → abre la conversación corta para profundizar. */
  onPickFact: (finding: Finding) => void
}

export function MonthReport({ cards, onPickFact }: Props) {
  if (cards.length === 0) return null
  const verdict = cards.find((c) => c.id === 'deficit-summary') ?? null
  const obstacles = cards.filter((c) => c.isObstacle)
  const levers = cards.filter((c) => !c.isObstacle && c.id !== 'deficit-summary')
  // El conteo de días en déficit para el cierre ("ya tienes 13 días"). Se extrae
  // del primer número de la métrica ("13 de 24"); match defensivo (si el formato
  // cambia, cae al cierre genérico en vez de romperse).
  const deficitCount = verdict?.metric.value.match(/^\d+/)?.[0] ?? null

  return (
    <View style={styles.wrap}>
      {verdict ? <VerdictBlock finding={verdict} /> : null}

      {obstacles.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>DÓNDE SE TE VA</Text>
          {obstacles.map((f) => (
            <FactCard key={f.id} finding={f} onPress={() => onPickFact(f)} />
          ))}
        </View>
      ) : null}

      {levers.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>LO QUE TE SOSTIENE</Text>
          {levers.map((f) => (
            <FactCard key={f.id} finding={f} onPress={() => onPickFact(f)} />
          ))}
        </View>
      ) : null}

      <Text style={styles.close}>
        {deficitCount
          ? `Nada de esto es un veredicto sobre ti. Es tu punto de partida, y ya tienes ${deficitCount} días que lo prueban.`
          : 'Nada de esto es un veredicto sobre ti. Es tu punto de partida.'}
      </Text>
    </View>
  )
}

/* ── El veredicto (¿vas bien?) ─────────────────────────────────────────── */

function VerdictBlock({ finding }: { finding: Finding }) {
  const [w, setW] = useState(0)
  const onBand = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width
    if (nw > 0 && Math.abs(nw - w) > 1) setW(nw)
  }
  return (
    <View style={styles.verdict}>
      <Text style={styles.verdictEyebrow}>TU MES</Text>
      <View style={styles.band} onLayout={onBand}>
        {w > 0 ? <FindingConstellation finding={finding} width={w} /> : null}
      </View>
      <Text style={styles.verdictLine}>{finding.phrase.lead}</Text>
      <Text style={styles.verdictFact}>{finding.phrase.support}</Text>
      {finding.contrast ? <Text style={styles.verdictContrast}>{finding.contrast}</Text> : null}
    </View>
  )
}

/* ── Una card de HECHO (obstáculo o palanca) ──────────────────────────── */

function FactCard({ finding, onPress }: { finding: Finding; onPress: () => void }) {
  const accent = constellationAccent(finding)
  const chart = finding.charts[0]

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${finding.phrase.support} ${finding.contrast ?? ''} Entenderlo.`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.fact}>{finding.phrase.support}</Text>
      {chart ? (
        <View style={styles.chart}>
          <InsightChart chart={chart} tint={accent} />
        </View>
      ) : null}
      {finding.contrast ? <Text style={styles.contrast}>{finding.contrast}</Text> : null}
      <View style={styles.cardFoot}>
        <Text style={[styles.footLink, { color: accent }]}>Entenderlo →</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 28 },
  // ── Veredicto ──
  verdict: { gap: 8 },
  verdictEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 2,
    color: colors.oroSoft,
  },
  band: { alignSelf: 'stretch', marginVertical: 2 },
  verdictLine: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.headingLg,
    lineHeight: 28,
    color: colors.leche,
  },
  verdictFact: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.bone,
  },
  verdictContrast: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  // ── Secciones ──
  section: { gap: 14 },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.8,
    color: colors.niebla,
  },
  // ── Card de hecho ──
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9 },
  // El HECHO: prominente, en voz de dato (Hanken), con sus números.
  fact: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.title,
    lineHeight: 26,
    color: colors.leche,
  },
  chart: { marginVertical: 2 },
  // El contrapunto ("¿y los días que no?"), secundario pero factual.
  contrast: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.niebla,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footLink: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  // El cierre: la única voz cálida (Cormorant italic), puerta abierta.
  close: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 27,
    color: colors.leche,
  },
})
