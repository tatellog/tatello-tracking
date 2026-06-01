import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  num: number
  text: string
}

/*
 * Single task row of the Día 1 list. Numbered chip on the left, body
 * copy on the right. The chip carries the observatory GOLD (oro) so it
 * reads as the sky's light landing on the task, not as a magenta CTA —
 * magenta stays reserved for the screen's voice (title emphasis + CTA).
 * The surface is bgCard2 with a gold hairline so it sits in the same
 * warm register as the recap card above it (matching radius 16).
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.bgCard2,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    borderRadius: 16,
  },
  numChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.oroTint,
    borderWidth: 1,
    borderColor: colors.oroHairline,
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
