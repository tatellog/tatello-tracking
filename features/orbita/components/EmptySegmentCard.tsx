import { StyleSheet, Text, View } from 'react-native'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

type Props = {
  /** Magenta uppercase label at the top of the card. */
  eyebrow: string
  /** Single coach-voice paragraph; rendered in serif italic. */
  body: string
  /** Optional second line, lighter / smaller — concrete next steps. */
  hint?: string
}

/*
 * The "Stelar has nothing to read yet" card. Used by Día / Semana /
 * Mes when the user hasn't logged anything to daily_signals. Same
 * visual register as VozDeStelar so the empty state doesn't feel
 * like a different surface — it reads as Stelar's first sentence,
 * not as an error.
 *
 * The wrapping segment still renders its hero (orbital / galaxy /
 * black hole) in a "low brightness" state above this card. The card
 * is the prose half of that handoff: the visual says "this is your
 * sky"; the card says "we need a signal before there's anything to
 * point at".
 */
export function EmptySegmentCard({ eyebrow, body, hint }: Props) {
  return (
    <View style={styles.card}>
      <EyebrowLabel tone="magenta" size={10}>
        {eyebrow}
      </EyebrowLabel>
      <Text style={styles.body}>{body}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 22,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  body: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.leche,
  },
  hint: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.niebla,
  },
})
