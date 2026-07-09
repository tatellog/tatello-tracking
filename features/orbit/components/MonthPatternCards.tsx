import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, radius, typography } from '@/theme'

import type { Finding, FindingCategory } from '../findings'

/*
 * Las TARJETAS de hallazgo de la antesala. Cada una es un `Finding` del motor,
 * mostrado con su título específico a 0 taps. Card tapeable con contenedor
 * visible + ícono de chat (abre el detalle guiado). El borde toma el tinte de
 * la categoría.
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
      accessibilityLabel={`${finding.title}. Ver más.`}
      style={({ pressed }) => [
        styles.card,
        { borderColor: `${tint}55` },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.brand}>STELAR</Text>
        <Text style={styles.finding}>{finding.title}</Text>
        <Text style={styles.more}>Ver más ›</Text>
      </View>
      <ChatIcon color={colors.magentaHot} />
    </Pressable>
  )
}

/** Globo de conversación con 3 puntos — señala "abre un chat". */
function ChatIcon({ color }: { color: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path
        d="M5 4 h13 a2.5 2.5 0 0 1 2.5 2.5 v7 a2.5 2.5 0 0 1 -2.5 2.5 h-7 l-5 3.5 v-3.5 h-1 a2.5 2.5 0 0 1 -2.5 -2.5 v-7 a2.5 2.5 0 0 1 2.5 -2.5 Z"
        fill={color}
        opacity={0.9}
      />
      <Circle cx={8.5} cy={10} r={1.15} fill={colors.bg} />
      <Circle cx={12} cy={10} r={1.15} fill={colors.bg} />
      <Circle cx={15.5} cy={10} r={1.15} fill={colors.bg} />
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
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  body: { flex: 1, gap: 6 },
  brand: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.6,
    color: colors.magenta,
  },
  finding: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 22,
    color: colors.leche,
  },
  more: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.magentaHot,
    marginTop: 2,
  },
})
