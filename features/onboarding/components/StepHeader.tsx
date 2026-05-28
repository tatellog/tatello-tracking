import { StyleSheet, Text, View } from 'react-native'

import { EmText } from '@/components/EmText'
import { EyebrowLabel, type EyebrowTone } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

type Props = {
  eyebrow?: string
  eyebrowColor?: 'magenta' | 'niebla'
  /** "upper" applies UPPERCASE + tracking; "none" keeps the eyebrow in title case (e.g. "Sofía,"). */
  eyebrowCase?: 'upper' | 'none'
  /** Hanken 900 36px title. */
  question: string
  /** Word within `question` rendered in Cormorant italic magenta. First match wins. */
  questionEmphasis?: string
  hint?: string
}

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
        eyebrowCase === 'upper' ? (
          <EyebrowLabel
            tone={eyebrowColor as EyebrowTone}
            size={10.5}
            tracking={2.5}
            style={styles.eyebrowMargin}
          >
            {eyebrow}
          </EyebrowLabel>
        ) : (
          <Text style={[styles.eyebrowFreeform, styles.eyebrowMargin, toneStyle(eyebrowColor)]}>
            {eyebrow}
          </Text>
        )
      ) : null}

      <EmText
        text={question}
        emphasis={questionEmphasis}
        emStyle={styles.questionEmphasis}
        style={styles.question}
      />

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

function toneStyle(tone: 'magenta' | 'niebla') {
  return { color: tone === 'magenta' ? colors.magenta : colors.niebla }
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  eyebrowMargin: { marginBottom: 10 },
  eyebrowFreeform: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
  },
  question: {
    fontFamily: typography.displayHeavy,
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 36,
    color: colors.leche,
  },
  questionEmphasis: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 34,
    color: colors.magenta,
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 20,
    color: colors.bone,
  },
})
