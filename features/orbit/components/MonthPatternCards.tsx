import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, radius, typography } from '@/theme'

import type { Chart, Finding, FindingCategory } from '../findings'

/*
 * Las TARJETAS de hallazgo de la antesala. La card se camuflaba con el fondo de
 * Órbita Mes (degradado VINO→casi-negro): NINGÚN tono fijo de fondo la separa en
 * todo el degradado. Solución: card HIGHLIGHTED que resalta por sí sola —
 *   · borde del color de la DIMENSIÓN a ~70% (contorno claro en cualquier zona),
 *   · glow suave de la dimensión (la zona baja del fondo es oscura, sí se ve),
 *   · lavado interior tenue del color (se siente "encendida" con su dimensión),
 *   · barra de acento lateral + ícono de burbuja de chat (abre el detalle).
 * Usa `metric` + `confidence` como evidencia; tag de dimensión (no "STELAR").
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
        { borderColor: `${tint}B3`, shadowColor: tint },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Lavado interior del color de la dimensión — "encendida". */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: `${tint}12` }]}
      />
      {/* Barra de acento lateral. */}
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

      {/* El hallazgo. */}
      <Text style={styles.title}>{finding.title}</Text>

      {/* Mini-semana (constelación) cuando es por día de semana. */}
      {weekChart ? <MiniWeek bars={weekChart.bars} tint={tint} /> : null}

      {/* Datum de evidencia (métrica). */}
      <View style={[styles.metric, { backgroundColor: `${tint}2E` }]}>
        <Text style={styles.metricValue}>{finding.metric.value}</Text>
        <Text style={styles.metricDot}>·</Text>
        <Text style={styles.metricLabel}>{finding.metric.label}</Text>
      </View>

      {/* Fila-CTA: "Ver el detalle" + burbuja de chat (abre el detalle guiado). */}
      <View style={styles.cta}>
        <Text style={[styles.ctaText, { color: tint }]}>Ver el detalle ›</Text>
        <ChatBubble color={tint} />
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

/** Burbuja de conversación con 3 puntos — abre el detalle guiado. */
function ChatBubble({ color }: { color: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path
        d="M5 4 h13 a2.6 2.6 0 0 1 2.6 2.6 v7.2 a2.6 2.6 0 0 1 -2.6 2.6 h-7 l-4.8 3.4 v-3.4 h-1.2 a2.6 2.6 0 0 1 -2.6 -2.6 v-7.2 a2.6 2.6 0 0 1 2.6 -2.6 Z"
        fill={color}
      />
      <Circle cx={8.6} cy={10.2} r={1.2} fill={colors.bg} />
      <Circle cx={12} cy={10.2} r={1.2} fill={colors.bg} />
      <Circle cx={15.4} cy={10.2} r={1.2} fill={colors.bg} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: 1.5,
    paddingTop: 18,
    paddingBottom: 16,
    paddingLeft: 22,
    paddingRight: 16,
    gap: 15,
    overflow: 'hidden',
    // Glow de la dimensión (shadowColor = tint, inyectado inline). La zona baja
    // del fondo es oscura → el halo de color sí se ve (highlighted).
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  accent: { position: 'absolute', left: 10, top: 16, bottom: 16, width: 3, borderRadius: 2 },
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
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 12,
  },
  ctaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
})
