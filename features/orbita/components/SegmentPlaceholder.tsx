import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

/* A quiet "still forming" body for a Tu Órbita segment, shown until
 * its real content lands. STELAR never shows a sad void — the system
 * is always taking shape (see docs/tu-orbita-design.md §8). */
export function SegmentPlaceholder({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string
  title: string
  body: string
}) {
  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <EyebrowLabel tone="niebla" size={10}>
        {eyebrow}
      </EyebrowLabel>
      <Text style={styles.star}>✦</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  star: {
    marginTop: 24,
    fontSize: 30,
    color: colors.bruma,
  },
  // Serif italic — the poetic / coach register.
  title: {
    marginTop: 18,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 24,
    color: colors.leche,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
    textAlign: 'center',
  },
})
