import { useState } from 'react'
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import type { Chart, Finding, FindingCategory } from '../findings'
import { ConfidenceBar } from './ConfidenceBar'
import {
  DeficitBraceletConstellation,
  RelationConstellation,
  type RelationDay,
  WeekStripConstellation,
} from './finding-constellations'

/*
 * Pantalla 2 · los HALLAZGOS del mes como CIELO DE OBJETOS (no reporte de
 * texto). Cada hallazgo es una carta celeste del MISMO peso y chasis (no hay
 * hero + sobras): un objeto-constelación que dibuja SU relación + una frase
 * corta que mezcla dato (Hanken) y lectura (Cormorant italic). La jerarquía la
 * da el ORDEN (el motor ya rankea), no el tamaño ni un marco encendido.
 *
 * Anatomía por card: eyebrow-relación · objeto-constelación (banda fija) ·
 * frase mixta · fila de cierre (consistencia ●●● + "Entender →"). La card
 * entera es el touch target.
 */

type Props = {
  cards: Finding[]
  onPick: (finding: Finding) => void
  /** Voz de IA por hallazgo (id → {lead, caption}). Si falta o no trae un id,
   *  la card cae a su texto determinístico. El soporte con números nunca es IA. */
  voice?: Record<string, { lead: string; caption: string }> | null
}

/** Color de acento de cada hallazgo (nodo A + eyebrow + consistencia). */
function accentFor(f: Finding): string {
  switch (f.id) {
    case 'water-deficit':
      return colors.signal.agua
    case 'training-deficit':
      return colors.signal.entreno
    case 'deficit-summary':
      return colors.magenta
    case 'weekday-calories':
      return colors.oroSoft
    default:
      return TINT[f.category] ?? colors.magenta
  }
}

const TINT: Record<FindingCategory, string> = {
  deficit: colors.magenta,
  movimiento: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  alimentacion: colors.dimension.alimento,
}

/** Eyebrow: la relación observada (dos dimensiones juntas), sin afirmar causa.
 *  El VALOR lo carga la lectura líder; el eyebrow solo nombra qué se cruzó. */
function eyebrowFor(f: Finding): string {
  switch (f.id) {
    case 'water-deficit':
      return f.emerging ? 'APENAS ASOMA · AGUA' : 'AGUA · DÉFICIT'
    case 'training-deficit':
      return f.emerging ? 'APENAS ASOMA · MOVIMIENTO' : 'MOVIMIENTO · DÉFICIT'
    case 'deficit-summary':
      return 'TU MES, EN UNA LÍNEA'
    case 'weekday-calories':
      return 'TU SEMANA'
    default:
      return 'HALLAZGO'
  }
}

export function MonthPatternCards({ cards, onPick, voice }: Props) {
  if (cards.length === 0) return null
  return (
    <View style={styles.wrap}>
      {cards.map((f, i) => (
        <FindingConstellationCard
          key={f.id}
          finding={f}
          hero={i === 0}
          voice={voice?.[f.id] ?? null}
          onPress={() => onPick(f)}
        />
      ))}
    </View>
  )
}

/* ── Card-constelación (una por hallazgo, mismo chasis) ───────────────── */

function FindingConstellationCard({
  finding,
  hero,
  voice,
  onPress,
}: {
  finding: Finding
  hero: boolean
  voice: { lead: string; caption: string } | null
  onPress: () => void
}) {
  const accent = accentFor(finding)
  const [bandW, setBandW] = useState(0)
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0 && Math.abs(w - bandW) > 1) setBandW(w)
  }
  // La IA reformula lead/caption; el soporte (números) SIEMPRE determinístico.
  const lead = voice?.lead ?? finding.phrase.lead
  const caption = voice?.caption ?? finding.phrase.caption
  const { support } = finding.phrase

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrowFor(finding)}. ${lead} ${support}. ${caption} Entender.`}
      style={({ pressed }) => [
        styles.card,
        hero && { borderColor: `${accent}59` },
        pressed && styles.pressed,
      ]}
    >
      {/* Hero (el norte) lleva un lavado de acento suave para destacar sin gritar. */}
      {hero ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `${accent}0F` }]}
        />
      ) : null}

      <Text style={[styles.eyebrow, { color: accent }]}>{eyebrowFor(finding)}</Text>

      <View style={styles.band} onLayout={onLayout}>
        {bandW > 0 ? <Constellation finding={finding} width={bandW} accent={accent} /> : null}
      </View>

      {/* VALOR primero: la lectura/palanca (serif italic, voz del coach). */}
      <Text style={styles.lead}>{lead}</Text>
      {/* Soporte con números (Hanken) — evidencia, no el grito. */}
      <Text style={styles.support}>{support}</Text>
      {/* Metacognición visible: el diferenciador, ya no escondido tras "Entender". */}
      <Text style={styles.caption}>{caption}</Text>

      <View style={styles.closeRow}>
        <ConfidenceBar confidence={finding.confidence} tint={accent} emerging={finding.emerging} />
        <View style={styles.cta}>
          <Text style={[styles.ctaText, { color: accent }]}>Entender</Text>
          <Text style={[styles.ctaArrow, { color: accent }]}>→</Text>
        </View>
      </View>
    </Pressable>
  )
}

/** Enruta cada hallazgo a su objeto-constelación, leyendo `finding.charts`. */
function Constellation({
  finding,
  width,
  accent,
}: {
  finding: Finding
  width: number
  accent: string
}) {
  const chart = finding.charts[0]

  if (finding.id === 'water-deficit' || finding.id === 'training-deficit') {
    const days = dotsOf(chart)
    return (
      <RelationConstellation
        colorA={accent}
        labelA={finding.id === 'water-deficit' ? 'AGUA' : 'ENTRENO'}
        days={days}
        width={width}
      />
    )
  }

  if (finding.id === 'deficit-summary') {
    const dots = dotsOf(chart)
    const lit = dots.filter((d) => d === 'strong').length
    return <DeficitBraceletConstellation lit={lit} total={dots.length} width={width} />
  }

  if (finding.id === 'weekday-calories' && chart?.kind === 'weekdayBars') {
    return <WeekStripConstellation bars={chart.bars} width={width} />
  }

  return null
}

function dotsOf(chart: Chart | undefined): RelationDay[] {
  if (chart?.kind === 'dotTimeline') return chart.dots as RelationDay[]
  return []
}

const styles = StyleSheet.create({
  wrap: { gap: 22 },
  pressed: { opacity: 0.92 },
  // Chasis único · hairline suave, sin borde tintado grueso ni sombra de color
  // (eso era lo que "gritaba"). El color vive en el objeto, el eyebrow y ●●●.
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 10,
    overflow: 'hidden',
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
  },
  band: { alignSelf: 'stretch', marginBottom: 2 },
  // El VALOR primero: la lectura/palanca en Cormorant italic (voz del coach).
  lead: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.headingLg,
    lineHeight: 27,
    color: colors.leche,
  },
  // Soporte: la evidencia con números (Hanken), secundaria a la lectura.
  support: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.bone,
  },
  // Metacognición: el so-what ("junto sí se ve"), niebla, no compite.
  caption: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
    marginTop: 2,
  },
  closeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ctaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
  },
  ctaArrow: { fontFamily: typography.ui, fontSize: typography.sizes.bodyLarge },
})
