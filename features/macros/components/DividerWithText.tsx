import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  text: string
}

/*
 * Row of "—— TEXT ——" used to soft-divide two zones (suggestor and
 * manual input). Hairline lines keep the divider quiet so it doesn't
 * compete with the cards above and below it.
 */
export function DividerWithText({ text }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.line} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.labelDim,
  },
})
