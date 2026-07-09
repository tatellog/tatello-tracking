import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, radius, typography } from '@/theme'

import type { PatternCard } from '../month-chat'

/*
 * Las TARJETAS de hallazgo de la antesala de Órbita Mes IA. Cada tarjeta es un
 * patrón que el motor detectó, mostrado con su evidencia a 0 taps (no un tema
 * abstracto). Al tocar "Ver más" abre su conversación guiada en la sala.
 *
 * Avatar tintado por dimensión (sueño=índigo/luna, agua=azul/gota, …); la firma
 * "STELAR" y el hallazgo en el cuerpo. Es lo que vuelve la antesala "las 3
 * cosas que encontré este mes" y cambia mes a mes.
 */

type Props = {
  cards: PatternCard[]
  onPick: (card: PatternCard) => void
}

/** Color de la dimensión → tinte del avatar (paleta cerrada, no hex sueltos). */
const TINT: Record<string, string> = {
  deficit: colors.magenta,
  sueno: colors.dimension.sueno,
  agua: colors.signal.agua,
  proteina: colors.signal.proteina,
  comida: colors.dimension.alimento,
  cuerpo: colors.dimension.cuerpo,
}
const tintFor = (k: string) => TINT[k] ?? colors.oroVect

export function MonthPatternCards({ cards, onPick }: Props) {
  if (cards.length === 0) return null
  return (
    <View style={styles.stack}>
      {cards.map((card) => (
        <Card key={card.id} card={card} onPress={() => onPick(card)} />
      ))}
    </View>
  )
}

function Card({ card, onPress }: { card: PatternCard; onPress: () => void }) {
  const tint = tintFor(card.colorKey)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.label}: ${card.finding}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.avatar, { borderColor: hairlineFor(tint) }]}>
        <DimensionIcon colorKey={card.colorKey} color={tint} />
      </View>
      <View style={styles.body}>
        <Text style={styles.brand}>STELAR</Text>
        <Text style={styles.finding}>{card.finding}</Text>
        <Text style={styles.more}>Ver más ›</Text>
      </View>
    </Pressable>
  )
}

/** Un halo tenue del color de la dimensión para el borde del avatar. */
function hairlineFor(hex: string) {
  return `${hex}44` // ~0.27 alpha
}

function DimensionIcon({ colorKey, color }: { colorKey: string; color: string }) {
  if (colorKey === 'sueno') return <Moon color={color} />
  if (colorKey === 'agua') return <Drop color={color} />
  return <Star color={color} />
}

function Moon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill={color} opacity={0.9} />
    </Svg>
  )
}

function Drop({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M12 3 C12 3 5 11 5 15.5 A7 7 0 0 0 19 15.5 C19 11 12 3 12 3 Z"
        fill={color}
        opacity={0.9}
      />
    </Svg>
  )
}

function Star({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M12 3 Q13 10.5 21 12 Q13 13.5 12 21 Q11 13.5 3 12 Q11 10.5 12 3 Z" fill={color} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 4 },
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
    marginTop: 4,
  },
})
