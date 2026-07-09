import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, radius, typography } from '@/theme'

import type { Finding, FindingCategory } from '../findings'

/*
 * Las TARJETAS de hallazgo de la antesala. Un TEASER simple, no un mini-detalle:
 * solo TÍTULO (el patrón) + SUBTÍTULO (la descripción) + burbuja de chat +
 * chevron. La evidencia (confianza, métrica, gráficas) vive en el detalle
 * (FindingView) — meterla aquí amontonaba la card.
 *
 * Highlighted por sí sola (el fondo de Órbita Mes es un degradado vino→negro,
 * ningún color de fondo fijo la separa): borde del color de la dimensión +
 * glow + lavado interior tenue + barra de acento lateral.
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
const tintFor = (c: FindingCategory) => TINT[c] ?? colors.magenta

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

      {/* Título (el patrón) + subtítulo (la descripción). */}
      <View style={styles.body}>
        <Text style={styles.title}>{finding.title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {finding.explanation}
        </Text>
      </View>

      {/* Burbuja de chat + chevron — abre el detalle guiado. */}
      <View style={styles.open}>
        <ChatBubble color={tint} />
        <Text style={[styles.chevron, { color: tint }]}>›</Text>
      </View>
    </Pressable>
  )
}

/** Burbuja de conversación con 3 puntos. */
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingLeft: 22,
    paddingRight: 16,
    overflow: 'hidden',
    // Glow de la dimensión (shadowColor = tint, inline). La zona baja del fondo
    // es oscura → el halo de color sí se ve (highlighted).
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  accent: { position: 'absolute', left: 10, top: 16, bottom: 16, width: 3, borderRadius: 2 },
  body: { flex: 1, gap: 6 },
  title: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.ui,
    lineHeight: 21,
    color: colors.leche,
  },
  subtitle: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chevron: { fontFamily: typography.ui, fontSize: typography.sizes.headingLg, marginTop: -2 },
})
