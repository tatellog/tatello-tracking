import { StyleSheet, Text, View } from 'react-native'

import { EmText } from '@/components/EmText'
import { EyebrowLabel, type EyebrowTone } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

type Props = {
  eyebrow?: string
  eyebrowColor?: 'magenta' | 'niebla'
  /** "upper" applies UPPERCASE + tracking; "none" keeps the eyebrow in title case (e.g. "Sofía,"). */
  eyebrowCase?: 'upper' | 'none'
  /** Horizontal alignment of the header block. Default 'left' so the
   *  eleven data-collection steps are unaffected. The reveal passes
   *  'center' so its eyebrow ("Tu cielo en Stelar") reads as a title
   *  for the centred art instead of floating top-left. */
  align?: 'left' | 'center'
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
  align = 'left',
  question,
  questionEmphasis,
  hint,
}: Props) {
  const centered = align === 'center'
  // Build the eyebrow style as a typed TextStyle[] so EyebrowLabel's
  // strict prop accepts it (no falsy members in the array).
  const eyebrowStyle = centered
    ? [styles.eyebrowMargin, styles.eyebrowCenter]
    : [styles.eyebrowMargin]
  return (
    <View style={[styles.wrap, centered && styles.wrapCenter]}>
      {eyebrow ? (
        eyebrowCase === 'upper' ? (
          <EyebrowLabel
            tone={eyebrowColor as EyebrowTone}
            size={10.5}
            tracking={2.5}
            style={eyebrowStyle}
          >
            {eyebrow}
          </EyebrowLabel>
        ) : (
          <Text style={[styles.eyebrowFreeform, ...eyebrowStyle, toneStyle(eyebrowColor)]}>
            {eyebrow}
          </Text>
        )
      ) : null}

      <EmText
        text={question}
        emphasis={questionEmphasis}
        emStyle={styles.questionEmphasis}
        style={[styles.question, centered && styles.questionCenter]}
      />

      {hint ? <Text style={[styles.hint, centered && styles.hintCenter]}>{hint}</Text> : null}
    </View>
  )
}

function toneStyle(tone: 'magenta' | 'niebla') {
  return { color: tone === 'magenta' ? colors.magenta : colors.niebla }
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  wrapCenter: { alignItems: 'center' },
  eyebrowMargin: { marginBottom: 10 },
  eyebrowCenter: { textAlign: 'center' },
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
  questionCenter: { textAlign: 'center' },
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
  hintCenter: { textAlign: 'center' },
})
