import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, typography } from '@/theme'

import type { Finding, FindingCategory } from '../findings'
import { ConfidenceBar } from './ConfidenceBar'

/*
 * Pantalla 2 como SESIÓN DE DESCUBRIMIENTO (no dashboard): divulgación
 * progresiva.
 *   Nivel 1 · HERO: un solo hallazgo (el de mayor confianza) en una card
 *     grande, "Lo que más llamó mi atención" + CTA "Entender este hallazgo".
 *   Nivel 2 · "Otros hallazgos": 2-3 observaciones secundarias como filas.
 *   Nivel 3 · "Ver todos": revela el resto.
 * La IA parece que ELIGIÓ lo importante, no que listó resultados. Menos carga
 * cognitiva, más narrativa.
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

const SECONDARY_PEEK = 3

export function MonthPatternCards({ cards, onPick }: Props) {
  const [showAll, setShowAll] = useState(false)
  if (cards.length === 0) return null

  const hero = cards[0]!
  const rest = cards.slice(1)
  const visible = showAll ? rest : rest.slice(0, SECONDARY_PEEK)

  return (
    <View style={styles.wrap}>
      <HeroCard finding={hero} onPress={() => onPick(hero)} />

      {rest.length > 0 ? (
        <View style={styles.secondary}>
          <Text style={styles.secTitle}>Otras observaciones</Text>
          <View style={styles.rows}>
            {visible.map((f, i) => (
              <SecondaryRow
                key={f.id}
                finding={f}
                isLast={i === visible.length - 1}
                onPress={() => onPick(f)}
              />
            ))}
          </View>
          {!showAll && rest.length > SECONDARY_PEEK ? (
            <Pressable
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              style={styles.seeAll}
            >
              <Text style={styles.seeAllText}>Ver todos</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/* ── Nivel 1 · Hero ──────────────────────────────────────────────────── */

function HeroCard({ finding, onPress }: { finding: Finding; onPress: () => void }) {
  const tint = tintFor(finding.category)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Lo que más llamó mi atención. ${finding.title}. Quiero entenderlo.`}
      style={({ pressed }) => [
        styles.hero,
        { borderColor: `${tint}B3`, shadowColor: tint },
        pressed && styles.pressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: `${tint}12` }]}
      />
      <Text style={[styles.heroEyebrow, { color: tint }]}>LO QUE MÁS LLAMÓ MI ATENCIÓN</Text>
      <Text style={styles.heroTitle}>{finding.title}</Text>
      <ConfidenceBar confidence={finding.confidence} tint={tint} />
      <View style={styles.heroCta}>
        <Text style={[styles.heroCtaText, { color: tint }]}>Quiero entenderlo</Text>
        <Text style={[styles.heroCtaArrow, { color: tint }]}>→</Text>
      </View>
    </Pressable>
  )
}

/* ── Nivel 2 · Otros hallazgos (filas) ───────────────────────────────── */

function SecondaryRow({
  finding,
  isLast,
  onPress,
}: {
  finding: Finding
  isLast: boolean
  onPress: () => void
}) {
  const tint = tintFor(finding.category)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${LABEL[finding.category]}. ${finding.title}.`}
      style={({ pressed }) => [styles.row, isLast && styles.rowLast, pressed && styles.pressed]}
    >
      <View style={[styles.bullet, { backgroundColor: tint }]} />
      <Text style={styles.rowText} numberOfLines={2}>
        {finding.title}
      </Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 22 },
  pressed: { opacity: 0.9 },
  // ── Hero ──
  hero: {
    backgroundColor: colors.bgCard2,
    borderRadius: radius.cardLg,
    borderWidth: 1.5,
    padding: 22,
    gap: 16,
    overflow: 'hidden',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  heroEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: 1.4,
  },
  // El hallazgo es un DATO → Hanken, no Cormorant (serif = solo voz del coach).
  heroTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.heading,
    lineHeight: 24,
    color: colors.leche,
  },
  heroCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  heroCtaText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.3,
  },
  heroCtaArrow: { fontFamily: typography.ui, fontSize: typography.sizes.heading },
  // ── Secundarios ──
  secondary: { gap: 12 },
  secTitle: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
    color: colors.niebla,
    marginLeft: 2,
  },
  rows: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.cardLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.oroHairlineSoft,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLast: { borderBottomWidth: 0 },
  bullet: { width: 7, height: 7, borderRadius: 3.5 },
  rowText: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: 19,
    color: colors.leche,
  },
  rowChevron: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.bodyLarge,
    color: colors.niebla,
  },
  seeAll: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  seeAllText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
    color: colors.oroSoft,
  },
})
