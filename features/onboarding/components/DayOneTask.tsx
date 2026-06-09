import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  num: number
  text: string
}

/*
 * Single task row of the Día 1 list. Numbered marker on the left, body
 * copy on the right. The marker carries the observatory GOLD (oro) so it
 * reads as the sky's light landing on the step, not as a magenta CTA —
 * magenta stays reserved for the screen's voice (title emphasis + CTA).
 *
 * NO card surface / border / radius: this is an INFORMATIONAL step, not an
 * action. A boxed row with a circular chip read as a tappable button (the
 * user can't press it — the real action is logging a meal in the app). So
 * it's flattened to a plain numbered instruction line; only the gold marker
 * disc remains, and even it loses its hard border so it scans as an index,
 * not a control.
 */
export function DayOneTask({ num, text }: Props) {
  return (
    <View style={styles.task}>
      <View style={styles.numChip}>
        <Text style={styles.numText}>{num}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  task: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  numChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.oroTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numText: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.micro,
    color: colors.oro,
  },
  text: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.leche,
  },
})
