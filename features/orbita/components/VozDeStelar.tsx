import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Voz de Stelar — the coach's reading for a segment. Serif-italic
 * narration (the app's poetic register) in a quiet card. The text is
 * MOCK for now; the órbita engine will write it from daily_signals.
 */
export function VozDeStelar({ scope, text }: { scope: string; text: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.eyebrowRow}>
        <View style={styles.dot} />
        <Text style={styles.eyebrow}>Voz de Stelar</Text>
        <Text style={styles.scope}> · {scope}</Text>
      </View>
      <Text style={styles.body}>{text}</Text>
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
})
