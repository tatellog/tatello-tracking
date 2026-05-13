import { Fragment } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type EyebrowColor = 'magenta' | 'niebla'

type Props = {
  eyebrow?: string
  eyebrowColor?: EyebrowColor
  /**
   * Algunos steps usan el nombre del usuario como eyebrow ("Sofía,")
   * en title case. Para esos casos `eyebrowCase="none"` apaga el
   * uppercase + tracking.
   */
  eyebrowCase?: 'upper' | 'none'
  /** Título — Hanken 900 black 36px con letter-spacing -4%. */
  question: string
  /**
   * Palabra destacada — se renderiza en Cormorant italic magenta
   * dentro del título. Si no aparece dentro del texto se ignora.
   */
  questionEmphasis?: string
  /** Subtítulo body en bone. */
  hint?: string
  /** Legacy alias for eyebrowColor — `mauve` redirige a magenta. */
  legacyMauveAlias?: never
}

/*
 * El header recurrente del wizard:
 *
 *     EYEBROW
 *     Título 36px con palabra destacada en italic magenta
 *     subtítulo bone
 *
 * `renderWithEmphasis` divide el texto en la primera coincidencia
 * (case-insensitive) — repetir la palabra dos veces destaca sólo la
 * primera, comportamiento heredado del wizard anterior.
 */
export function StepHeader({
  eyebrow,
  eyebrowColor = 'magenta',
  eyebrowCase = 'upper',
  question,
  questionEmphasis,
  hint,
}: Props) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? (
        <Text
          style={[
            styles.eyebrowBase,
            eyebrowColor === 'magenta' ? styles.eyebrowMagenta : styles.eyebrowNiebla,
            eyebrowCase === 'none' && styles.eyebrowNoTransform,
          ]}
        >
          {eyebrow}
        </Text>
      ) : null}

      <Text style={styles.question}>{renderWithEmphasis(question, questionEmphasis)}</Text>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

function renderWithEmphasis(text: string, emphasis?: string) {
  if (!emphasis) return text

  const idx = text.toLowerCase().indexOf(emphasis.toLowerCase())
  if (idx === -1) return text

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + emphasis.length)
  const after = text.slice(idx + emphasis.length)

  return (
    <Fragment>
      {before}
      <Text style={styles.questionEmphasis}>{match}</Text>
      {after}
    </Fragment>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  eyebrowBase: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  eyebrowMagenta: {
    color: colors.magenta,
  },
  eyebrowNiebla: {
    color: colors.niebla,
  },
  eyebrowNoTransform: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  question: {
    fontFamily: typography.displayHeavy,
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 36,
    color: colors.leche,
  },
  questionEmphasis: {
    // Cormorant italic 0.95em ≈ 34px. RN no soporta em, así que
    // usamos un fontSize próximo y dejamos el fontFamily italic.
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 34,
    color: colors.magenta,
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.bone,
  },
})
