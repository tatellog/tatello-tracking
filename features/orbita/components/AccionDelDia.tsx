import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * AccionDelDia — STELAR's "what moves the needle today" card. It
 * converts the reading into a single prioritised action, so the
 * orbital + Voz don't end as pure poetry. One action, not a list:
 * STELAR's job is to call the highest-leverage move, not to dump
 * every option.
 *
 * Visually heavier than Voz de Stelar — bordered with a soft magenta
 * tint and a magenta hairline — so it reads as the call-to-action it
 * is, not as more narration.
 */
export function AccionDelDia({ title, reason }: { title: string; reason: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Hoy mueve la aguja</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.reason}>{reason}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: colors.magentaTint,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.magentaDeep,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.magenta,
  },
  // The action — sans-serif so it reads as instruction, not coach prose.
  title: {
    marginTop: 9,
    fontFamily: typography.uiBold,
    fontSize: 19,
    lineHeight: 25,
    color: colors.leche,
    letterSpacing: -0.3,
  },
  // The why — quieter, serif italic, the coach voice.
  reason: {
    marginTop: 8,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.bone,
  },
})
