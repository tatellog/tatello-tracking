import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * AccionDelDia — one thing the reading suggests might help today.
 * An *invitation*, not a prescription: STELAR offers a single
 * low-effort move and the reason behind it; the user decides.
 *
 * Same calm card weight as Voz de Stelar (not a heavier CTA tint) —
 * it's a suggestion sitting beside the reading, not an order above it.
 */
export function AccionDelDia({ title, reason }: { title: string; reason: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Algo que quizá ayude hoy</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.reason}>{reason}</Text>
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
