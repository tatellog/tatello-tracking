import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

import type { VozParte } from '../mock'

/*
 * StelarHeadline — a tweet-length editorial line that sits above the
 * orbital diagram and gives the screen first-fold value. The full Voz
 * de Stelar card still lives at the bottom; this is its lifted lede.
 *
 * No card chrome: the headline floats on the cosmos, the way a
 * newspaper hero sits without a frame. The accent word is the same
 * celestial pink as the archetype emphasis, so the two lines rhyme.
 */
export function StelarHeadline({ parts }: { parts: readonly VozParte[] }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.body}>
        {parts.map((p, i) => (
          <Text key={i} style={p.tone === 'accent' ? styles.accent : undefined}>
            {p.text}
          </Text>
        ))}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    paddingHorizontal: 10,
  },
  body: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.title,
    lineHeight: 23,
    color: colors.bone,
    textAlign: 'center',
  },
  accent: {
    color: colors.magenta,
  },
})
