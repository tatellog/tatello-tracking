import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { VozParte } from '../mock'

/*
 * Voz de Stelar — the coach's reading for a segment. Serif-italic
 * narration (the app's poetic register) in a quiet card. Two body
 * modes: a plain `text` string (Mes), or `parts` — a run where words
 * carry an accent (magenta) or strong (a bold figure) weight. The
 * eyebrow can carry a right-side `tag` ("Cierre de semana"); when a
 * `signature` is given, a credit line closes the card with Stelar's
 * dots, confidence and comparison scope. Content is MOCK; the engine
 * writes it from daily_signals.
 */
export function StelarVoice({
  scope,
  text,
  parts,
  tag,
  signature,
  accent = colors.magenta,
}: {
  /** Optional context shown inline in the eyebrow — "esta semana",
   *  "este ciclo". Día omits it: the voice stands alone. */
  scope?: string
  text?: string
  parts?: readonly VozParte[]
  /** A right-aligned label in the eyebrow — e.g. "Cierre de semana". */
  tag?: string
  /** A bottom signature line: ●●● Stelar · Confianza alta · 4 sem
   *  comparadas. Tells the user how Stelar reached this reading. */
  signature?: { confidence: 'alta' | 'media' | 'baja'; scope: string }
  /** The card's accent — dot, eyebrow, accent words, signature. Defaults
   *  to magenta; pass `colors.oro` when the voice is "observatory light"
   *  (pattern detail) rather than "the dimension speaking". */
  accent?: string
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.eyebrowRow, tag ? styles.eyebrowRowSpread : null]}>
        <View style={styles.eyebrowLeft}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={[styles.eyebrow, { color: accent }]}>Voz de Stelar</Text>
          {scope ? <Text style={styles.scope}> · {scope}</Text> : null}
        </View>
        {tag ? <Text style={styles.tag}>{tag}</Text> : null}
      </View>
      <Text style={styles.body}>
        {parts
          ? parts.map((p, i) => (
              <Text
                key={i}
                style={
                  p.tone === 'accent'
                    ? [styles.accent, { color: accent }]
                    : p.tone === 'strong'
                      ? styles.strong
                      : undefined
                }
              >
                {p.text}
              </Text>
            ))
          : text}
      </Text>
      {signature ? (
        <View style={styles.signatureBlock}>
          <View style={styles.signatureRule} />
          <View style={styles.signatureRow}>
            <Text style={[styles.sigDots, { color: accent }]}>●●●</Text>
            <Text style={[styles.sigStelar, { color: accent }]}> Stelar </Text>
            <Text style={styles.sigMeta}>
              · Confianza {signature.confidence} · {signature.scope}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  eyebrowRowSpread: {
    justifyContent: 'space-between',
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.magenta,
    marginRight: 7,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  scope: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // The right-side tag — a quiet context like "Cierre de semana".
  tag: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Serif italic — the coach / poetic voice of the app. The voice
  // sits a hair larger than the rest of the body copy so it reads
  // first when the eye lands on the card.
  body: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.anchor,
    lineHeight: 25,
    color: colors.bone,
  },
  // An emphasised word — the same serif italic, lifted to magenta.
  accent: {
    color: colors.magenta,
  },
  // A figure (a number) — bold upright sans, so it reads as data.
  strong: {
    fontFamily: typography.uiBold,
    fontStyle: 'normal',
    fontSize: typography.sizes.ui,
    color: colors.leche,
  },
  signatureBlock: {
    marginTop: 14,
  },
  signatureRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginBottom: 10,
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sigDots: {
    fontSize: 7,
    letterSpacing: 2,
    color: colors.magenta,
  },
  sigStelar: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.magenta,
  },
  sigMeta: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
})
