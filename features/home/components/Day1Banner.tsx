import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

/*
 * Static banner that sits below the StreakCard on Día 1. It's the
 * verbal counterpart to the silent UI cues — telling the user, in
 * plain language, what they're meant to do next.
 *
 * Auto-removed once the user marks their first workout (the parent
 * stops rendering it the moment isFirstDay flips to false).
 */
export function Day1Banner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.eyebrow}>Día 1</Text>
      <Text style={styles.text}>
        Tu primer cuadrito está esperando. Marca tu entreno cuando lo termines y la racha empieza.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(168, 94, 124, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontFamily: typography.uiSemi,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.mauveDeep,
  },
  text: {
    fontFamily: typography.ui,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
})
