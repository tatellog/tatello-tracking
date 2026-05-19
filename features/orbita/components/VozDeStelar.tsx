import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { VozParte } from '../mock'

/*
 * Voz de Stelar — the coach's reading for a segment. Serif-italic
 * narration (the app's poetic register) in a quiet card. Two modes:
 * a plain `text` string (Semana / Mes), or `parts` — a run where
 * single words carry an accent (magenta) or strong (a bold figure)
 * weight, plus a `time` stamp. Content is MOCK; the órbita engine
 * will write it from daily_signals.
 */
export function VozDeStelar({
  scope,
  text,
  parts,
  time,
}: {
  scope: string
  text?: string
  parts?: readonly VozParte[]
  time?: string
}) {
  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLeft}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>Voz de Stelar</Text>
          {time ? null : <Text style={styles.scope}> · {scope}</Text>}
        </View>
        {time ? <Text style={styles.scope}>{time} · hoy</Text> : null}
      </View>
      <Text style={styles.body}>
        {parts
          ? parts.map((p, i) => (
              <Text
                key={i}
                style={
                  p.tone === 'accent'
                    ? styles.accent
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
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
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  scope: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  // Serif italic — the coach / poetic voice of the app.
  body: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 22,
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
    fontSize: 13,
    color: colors.leche,
  },
})
