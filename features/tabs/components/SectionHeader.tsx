import { StyleSheet, Text, View } from 'react-native'

import { EmText } from '@/components/EmText'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

type MetaValue = string | { value: string; label: string }

type Props = {
  label: string
  /**
   * Meta on the right. String renders italic; object renders `value` in
   * display-heavy magenta + `label` in serif italic bone.
   */
  meta?: MetaValue
  metaEmphasis?: string
}

export function SectionHeader({ label, meta, metaEmphasis }: Props) {
  return (
    <View style={styles.row}>
      <EyebrowLabel tone="magenta" style={styles.label}>
        {label}
      </EyebrowLabel>
      {meta ? renderMeta(meta, metaEmphasis) : null}
    </View>
  )
}

function renderMeta(meta: MetaValue, metaEmphasis?: string) {
  if (typeof meta === 'string') {
    return (
      <EmText
        text={meta}
        emphasis={metaEmphasis}
        emStyle={styles.metaInlineEm}
        style={styles.metaText}
        numberOfLines={1}
      />
    )
  }
  return (
    <Text style={styles.metaText} numberOfLines={1}>
      <Text style={styles.metaValue}>{meta.value}</Text>
      <Text style={styles.metaLabel}> {meta.label}</Text>
    </Text>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 22,
    marginBottom: 10,
  },
  label: {
    flex: 1,
  },
  metaText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.bone,
  },
  metaInlineEm: {
    color: colors.magenta,
  },
  metaValue: {
    fontFamily: typography.displayHeavy,
    fontStyle: 'normal',
    fontSize: 14,
    color: colors.magenta,
    letterSpacing: -0.5,
  },
  metaLabel: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.bone,
  },
})
