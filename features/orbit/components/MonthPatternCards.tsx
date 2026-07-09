import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import type { Finding, FindingCategory } from '../findings'
import { ConfidenceBar } from './ConfidenceBar'

/*
 * Las TARJETAS de hallazgo de la antesala ("Pantalla 2") — cards tipo Apple, una
 * por patrón: ícono de dimensión + nombre, el hallazgo, barra de confianza, y
 * CTA "Explorar". Highlighted por sí solas (el fondo de Órbita Mes es un
 * degradado vino→negro): borde del color de la dimensión + glow + lavado
 * interior + barra de acento lateral. Con aire (Apple), no amontonadas.
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
      accessibilityLabel={`${LABEL[finding.category]}. ${finding.title}. Explorar.`}
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

      {/* Ícono de dimensión + nombre. */}
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: `${tint}26`, borderColor: `${tint}80` }]}>
          <Text style={[styles.iconGlyph, { color: tint }]}>✦</Text>
        </View>
        <Text style={[styles.dimension, { color: tint }]}>
          {LABEL[finding.category].toUpperCase()}
        </Text>
      </View>

      {/* El hallazgo. */}
      <Text style={styles.title}>{finding.title}</Text>

      {/* Confianza. */}
      <ConfidenceBar confidence={finding.confidence} tint={tint} />

      {/* CTA. */}
      <View style={styles.cta}>
        <Text style={[styles.ctaText, { color: tint }]}>Explorar</Text>
        <Text style={[styles.ctaArrow, { color: tint }]}>→</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  card: {
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: 1.5,
    padding: 20,
    gap: 14,
    overflow: 'hidden',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: typography.sizes.body },
  dimension: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.leche,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  ctaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
  },
  ctaArrow: { fontFamily: typography.ui, fontSize: typography.sizes.bodyLarge },
})
