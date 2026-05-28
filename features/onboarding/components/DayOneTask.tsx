import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  num: number
  text: string
}

/*
 * Single task row of the Día 1 list. Numbered chip on the left, body
 * copy on the right. Pearl-elevated surface with a hairline border
 * keeps it visually subordinate to the photo card above it.
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
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    borderRadius: 14,
  },
  numChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.magentaTint,
    borderWidth: 1,
    borderColor: colors.magentaDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numText: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.micro,
    color: colors.magenta,
  },
  text: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 19,
    color: colors.leche,
  },
})
