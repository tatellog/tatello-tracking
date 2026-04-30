import { Fragment } from 'react'
import { StyleSheet, Text, View, type TextStyle } from 'react-native'

import { colors, typography } from '@/theme'

type EyebrowColor = 'mauve' | 'muted'

type Props = {
  eyebrow?: string
  eyebrowColor?: EyebrowColor
  /**
   * Some steps render the user's name as the eyebrow ("Sofía,") and
   * want it in title case rather than uppercase, but still in mauve.
   * Pass `eyebrowCase="none"` for those; the default uppercases.
   */
  eyebrowCase?: 'upper' | 'none'
  question: string
  questionEmphasis?: string
  hint?: string
}

/*
 * The recurring opening of a wizard step:
 *
 *     EYEBROW
 *     ¿Pregunta con palabra destacada?
 *     hint con tono más suave
 *
 * The destacada word reuses the original casing/punctuation supplied
 * by the caller so the highlight reads naturally in Spanish (acentos,
 * mayúsculas iniciales, etc.). renderWithEmphasis splits on the first
 * match only — repeating the same word twice in one question would
 * highlight just the first occurrence, which has been fine so far.
 */
export function StepHeader({
  eyebrow,
  eyebrowColor = 'muted',
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
            styles.eyebrow,
            eyebrowColor === 'mauve' ? styles.eyebrowMauve : styles.eyebrowMuted,
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

const eyebrowBase: TextStyle = {
  fontFamily: typography.uiSemi,
  fontSize: 10,
  letterSpacing: typography.letterSpacing.uppercaseWide,
  textTransform: 'uppercase',
  marginBottom: 14,
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  eyebrow: eyebrowBase,
  eyebrowMauve: {
    ...eyebrowBase,
    color: colors.mauveDeep,
  },
  eyebrowMuted: {
    ...eyebrowBase,
    color: colors.labelMuted,
  },
  eyebrowNoTransform: {
    textTransform: 'none',
    letterSpacing: 0,
  },
  question: {
    fontFamily: typography.display,
    fontSize: 28,
    letterSpacing: -1.2,
    lineHeight: 32,
    color: colors.inkPrimary,
  },
  questionEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  hint: {
    marginTop: 12,
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 20,
    color: colors.labelMuted,
  },
})
