import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import type { Chart, Finding, FindingCategory } from '../findings'

/*
 * Las TARJETAS de hallazgo de la antesala. Rediseño (target-user + uxui +
 * illustrator): la card ANTES no se veía (fondo casi igual al negro, borde
 * tenue) y todo flotaba suelto. Ahora existe como objeto premium:
 *   · SOMBRA oscura que la despega del cielo estrellado (no glow, que se fundía).
 *   · BARRA de acento lateral del color de la DIMENSIÓN (no magenta fijo).
 *   · tag de dimensión (fuera "STELAR", redundante con StelarSpeaks arriba).
 *   · usa `metric` + `confidence` (antes desperdiciados) como evidencia.
 *   · mini-semana (constelación) cuando el hallazgo es por día de semana.
 *   · fila-CTA clara "Ver el detalle ›".
 */

type Props = {
  cards: Finding[]
  onPick: (finding: Finding) => void
}

const TINT: Record<FindingCategory, string> = {
  deficit: colors.magenta,
  movimiento: colors.dimension.cuerpo,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  alimentacion: colors.dimension.alimento,
}
const LABEL: Record<FindingCategory, string> = {
  deficit: 'Déficit',
  movimiento: 'Movimiento',
  sueno: 'Sueño',
  agua: 'Agua',
  proteina: 'Proteína',
  alimentacion: 'Alimentación',
}
const tintFor = (c: FindingCategory) => TINT[c] ?? colors.magenta

/** Solidez del patrón (cuánto se repitió), en palabras · nunca "% probable". */
function tier(confidence: number): { dots: boolean[]; word: string } {
  if (confidence >= 75) return { dots: [true, true, true], word: 'se repitió mucho' }
  if (confidence >= 55) return { dots: [true, true, false], word: 'se repitió' }
  return { dots: [true, false, false], word: 'empieza a asomar' }
}

export function MonthPatternCards({ cards, onPick }: Props) {
  if (cards.length === 0) return null
  return (
    <View style={styles.stack}>
      {cards.map((f) => (
        <Card key={f.id} finding={f} onPress={() => onPick(f)} />
      ))}
    </View>
  )
}

function Card({ finding, onPress }: { finding: Finding; onPress: () => void }) {
  const tint = tintFor(finding.category)
  const t = tier(finding.confidence)
  const weekChart = finding.charts.find(
    (c): c is Extract<Chart, { kind: 'weekdayBars' }> => c.kind === 'weekdayBars',
  )

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${finding.title}. Ver el detalle.`}
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${tint}3A` },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Barra de acento lateral — identidad de dimensión + ancla la card. */}
      <View style={[styles.accent, { backgroundColor: tint }]} />

      {/* Header: tag de dimensión + solidez del patrón. */}
      <View style={styles.header}>
        <Text style={[styles.tag, { color: tint }]}>✦ {LABEL[finding.category].toUpperCase()}</Text>
        <View style={styles.tierRow}>
          <View style={styles.dots}>
            {t.dots.map((on, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: on ? tint : colors.bruma, opacity: on ? 1 : 0.5 },
                ]}
              />
            ))}
          </View>
          <Text style={styles.tierWord}>{t.word}</Text>
        </View>
      </View>

      {/* El hallazgo — la lectura primaria. */}
      <Text style={styles.title}>{finding.title}</Text>

      {/* Mini-semana (constelación) cuando el patrón es por día de semana. */}
      {weekChart ? <MiniWeek bars={weekChart.bars} tint={tint} /> : null}

      {/* Datum de evidencia (métrica) — lo que da confianza. */}
      <View style={[styles.metric, { backgroundColor: `${tint}18` }]}>
        <Text style={styles.metricValue}>{finding.metric.value}</Text>
        <Text style={styles.metricDot}>·</Text>
        <Text style={styles.metricLabel}>{finding.metric.label}</Text>
      </View>

      {/* Fila-CTA — abre el detalle guiado. */}
      <View style={styles.cta}>
        <View style={styles.ctaLeft}>
          <Text style={[styles.ctaText, { color: tint }]}>Ver el detalle</Text>
        </View>
        <Text style={[styles.ctaChevron, { color: tint }]}>›</Text>
      </View>
    </Pressable>
  )
}

/** La semana como 7 nodos; el día del hallazgo, encendido. */
function MiniWeek({ bars, tint }: { bars: { label: string; highlight: boolean }[]; tint: string }) {
  return (
    <View style={styles.week}>
      {bars.map((b, i) => (
        <View key={i} style={styles.weekCol}>
          <View
            style={[
              styles.weekDot,
              b.highlight
                ? { backgroundColor: tint, width: 7, height: 7, borderRadius: 3.5 }
                : styles.weekDotOff,
            ]}
          />
          <Text style={[styles.weekLabel, b.highlight && { color: tint }]}>{b.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: 1,
    paddingTop: 15,
    paddingBottom: 13,
    paddingLeft: 20,
    paddingRight: 16,
    gap: 12,
    overflow: 'hidden',
    // Sombra OSCURA: la despega del cielo estrellado (glow se fundía con él).
    shadowColor: colors.sombra,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  tierWord: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  title: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.leche,
  },
  // Mini-semana.
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 30 },
  weekCol: { alignItems: 'center', gap: 5 },
  weekDot: { width: 4, height: 4, borderRadius: 2 },
  weekDotOff: { backgroundColor: colors.leche, opacity: 0.18 },
  weekLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.nano,
    letterSpacing: 0.5,
    color: colors.niebla,
  },
  // Métrica (evidencia).
  metric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  metricValue: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    color: colors.leche,
  },
  metricDot: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  metricLabel: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.micro,
    color: colors.bone,
  },
  // Fila-CTA.
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 11,
  },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
  ctaChevron: { fontFamily: typography.ui, fontSize: typography.sizes.bodyLarge, marginTop: -2 },
})
