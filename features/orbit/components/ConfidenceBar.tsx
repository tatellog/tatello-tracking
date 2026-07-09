import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * ConfidenceBar — la CONSISTENCIA de un hallazgo, SIN porcentaje. El "82%" era
 * falsa precisión: el confidence es un ratio de cuánto se repitió, no una
 * probabilidad; mostrarlo como % suena a algoritmo y hace desconfiar. En vez de
 * eso, puntos + una palabra que habla de repetición, no de probabilidad.
 */

/** Ratio (0–100) → puntos + palabra de consistencia (nunca "alta"/"%"). */
function tier(confidence: number): { dots: boolean[]; word: string } {
  if (confidence >= 80) return { dots: [true, true, true], word: 'Muy consistente' }
  if (confidence >= 60) return { dots: [true, true, false], word: 'Consistente' }
  return { dots: [true, false, false], word: 'Apareció varias veces' }
}

export function ConfidenceBar({ confidence, tint }: { confidence: number; tint: string }) {
  const { dots, word } = tier(confidence)
  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {dots.map((on, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: on ? tint : colors.bruma, opacity: on ? 1 : 0.5 },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.word, { color: tint }]}>{word}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  word: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
  },
})
