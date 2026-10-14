/*
 * "¿Esto coincide con tus días?" al pie del detalle de un hallazgo (ST-008
 * corte 2). UI llana (Hanken), sin ✦: lo encontró el motor. Tres respuestas
 * del mismo peso, en neutro (ninguna es la "buena"). Al responder la pregunta
 * se vuelve una línea quieta y no se vuelve a preguntar. Copy revisado con
 * voice-and-copy: la respuesta NO cambia lo que detecta el motor, así que el
 * cierre no promete más que "anotado".
 */
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { colors, radius, typography } from '@/theme'

import type { FeedbackAnswer } from '../insight-feedback'

const OPTIONS: { value: FeedbackAnswer; label: string }[] = [
  { value: 'matches', label: 'Sí, me pasa' },
  { value: 'no_match', label: 'No coincide' },
  { value: 'unsure', label: 'No sé' },
]

export type InsightFeedbackProps = {
  answer: FeedbackAnswer | null
  onAnswer: (answer: FeedbackAnswer) => void
}

export function InsightFeedback({ answer, onAnswer }: InsightFeedbackProps) {
  if (answer) {
    return (
      <Animated.Text entering={FadeIn.duration(220)} style={styles.thanks}>
        {answer === 'no_match'
          ? 'Anotado. Ya no te lo mostramos en Hoy.'
          : 'Gracias. Queda anotado.'}
      </Animated.Text>
    )
  }
  return (
    <View style={styles.wrap}>
      <Text style={styles.question}>¿Esto coincide con tus días?</Text>
      <View style={styles.options}>
        {OPTIONS.map((o) => (
          <View key={o.value} style={styles.slot}>
            <Pressable
              onPress={() => onAnswer(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={styles.optionText}>{o.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, gap: 12 },
  question: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  options: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1 },
  option: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bgCard2,
  },
  pressed: { opacity: 0.7 },
  optionText: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  thanks: {
    marginTop: 24,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
