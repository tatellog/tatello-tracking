import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { colors } from '@/theme'

/* A softly breathing dot — Stelar's presence: it is reading you
 * now, not showing a frozen stat. Used in the Día and Semana
 * "Leído por Stelar" credit rows. */
export function LiveDot() {
  const p = useSharedValue(0)
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    )
    return () => cancelAnimation(p)
  }, [p])

  const halo = useAnimatedStyle(() => ({
    opacity: 0.16 + p.value * 0.4,
    transform: [{ scale: 0.7 + p.value * 0.7 }],
  }))

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.halo, halo]} />
      <View style={styles.core} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  halo: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.magenta,
  },
  core: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.magentaHot,
  },
})
