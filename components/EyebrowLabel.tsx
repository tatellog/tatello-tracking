import { StyleSheet, Text, type TextStyle } from 'react-native'

import { colors, typography } from '@/theme'

export type EyebrowTone = 'magenta' | 'niebla' | 'bone'

type Props = {
  children: string
  tone?: EyebrowTone
  /** 9 px (tightest, e.g. stat captions) / 10 px / 11 px (CTAs). */
  size?: 9 | 9.5 | 10 | 10.5 | 11 | 11.5
  /** Letter-spacing override in raw points. Defaults to 2.2 (matches 0.22em on 10 px). */
  tracking?: number
  style?: TextStyle | TextStyle[]
}

const TONE_COLOR: Record<EyebrowTone, string> = {
  magenta: colors.magenta,
  niebla: colors.niebla,
  bone: colors.bone,
}

export function EyebrowLabel({
  children,
  tone = 'magenta',
  size = 10,
  tracking = 2.2,
  style,
}: Props) {
  return (
    <Text
      style={[
        styles.base,
        { color: TONE_COLOR[tone], fontSize: size, letterSpacing: tracking },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: {
    fontFamily: typography.uiBold,
    textTransform: 'uppercase',
  },
})
