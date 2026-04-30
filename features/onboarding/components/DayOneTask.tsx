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
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
  },
  numChip: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.pearlMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontFamily: typography.displayMedium,
    fontSize: 10,
    color: colors.mauveDeep,
  },
  text: {
    flex: 1,
    fontFamily: typography.uiMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkPrimary,
  },
})
