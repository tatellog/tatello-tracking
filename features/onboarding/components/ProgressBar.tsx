import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

type Props = {
  current: number
  total: number
}

/*
 * Segmented progress for the wizard. N stripes, equal width, gap 4.
 * Filled stripes are mauve; remaining ones share the wizard's hairline
 * tone so the inactive bar reads as a faint suggestion of "more to
 * go" instead of an empty rail. No animation in v1 — the screen
 * transition itself is the cue that progress moved.
 */
export function ProgressBar({ current, total }: Props) {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: current, min: 0, max: total }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, i < current ? styles.segmentFilled : styles.segmentEmpty]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    height: 3,
    width: '100%',
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  segmentFilled: {
    backgroundColor: colors.mauveDeep,
  },
  segmentEmpty: {
    backgroundColor: colors.borderSubtle,
  },
})
