import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import type { Nivel, NivelOption } from '@/features/profile/calcMacros'
import { colors, typography } from '@/theme'

/*
 * Discrete snap slider for the deficit / surplus level. No native lib
 * (Expo Go safe) — a Reanimated thumb over a magenta track with N
 * evenly-spaced stops. Dragging snaps the selected index to the nearest
 * stop (haptic on each crossing); tapping a stop jumps to it. The thumb
 * follows the finger while dragging and settles onto the chosen stop on
 * release. Controlled by `value` (a Nivel key); reports `onChange(key)`.
 */

const THUMB = 26
const TRACK_H = 4

type Props = {
  stops: readonly NivelOption[]
  value: Nivel
  onChange: (next: Nivel) => void
}

export function DeficitSlider({ stops, value, onChange }: Props) {
  const count = stops.length
  const selectedIndex = Math.max(
    0,
    stops.findIndex((s) => s.key === value),
  )

  // Track inner width (between thumb centers) — measured on layout.
  const trackW = useSharedValue(0)
  // Thumb center x within the track, 0..trackW.
  const pos = useSharedValue(0)
  const dragging = useSharedValue(false)
  // Last index reported during a drag, so we haptic + fire once per stop.
  const lastIdx = useSharedValue(selectedIndex)

  const slotX = (i: number, w: number) => (count <= 1 ? 0 : (i / (count - 1)) * w)

  // When the selection changes from outside (or on first layout) and we
  // aren't dragging, settle the thumb onto its stop.
  useEffect(() => {
    if (!dragging.value && trackW.value > 0) {
      pos.value = withTiming(slotX(selectedIndex, trackW.value), { duration: 200 })
    }
    lastIdx.value = selectedIndex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex])

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync()
  }

  const commit = (idx: number) => {
    const next = stops[idx]
    if (next && next.key !== value) {
      haptic()
      onChange(next.key)
    }
  }

  const nearestIndex = (x: number, w: number) => {
    'worklet'
    if (w <= 0 || count <= 1) return 0
    const raw = (x / w) * (count - 1)
    const r = Math.round(raw)
    return r < 0 ? 0 : r > count - 1 ? count - 1 : r
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      dragging.value = true
    })
    .onChange((e) => {
      const w = trackW.value
      const next = pos.value + e.changeX
      pos.value = next < 0 ? 0 : next > w ? w : next
      const idx = nearestIndex(pos.value, w)
      if (idx !== lastIdx.value) {
        lastIdx.value = idx
        runOnJS(commit)(idx)
      }
    })
    .onEnd(() => {
      dragging.value = false
      pos.value = withTiming(slotX(lastIdx.value, trackW.value), { duration: 160 })
    })
    .onFinalize(() => {
      dragging.value = false
    })

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value }],
  }))
  const fillStyle = useAnimatedStyle(() => ({
    width: pos.value,
  }))

  const jumpTo = (i: number) => {
    pos.value = withTiming(slotX(i, trackW.value), { duration: 160 })
    commit(i)
  }

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={pan}>
        <View style={styles.hitbox}>
          {/* The measured track. Thumb travels [0, trackW]; we inset the
              hitbox by THUMB/2 each side so the thumb never clips. */}
          <View
            style={styles.track}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width
              trackW.value = w
              pos.value = slotX(selectedIndex, w)
            }}
          >
            <View style={styles.trackBg} />
            <Animated.View style={[styles.trackFill, fillStyle]} />
            {/* Tick dots at each stop. */}
            {stops.map((s, i) => (
              <View
                key={s.key}
                pointerEvents="none"
                style={[styles.tick, { left: `${count <= 1 ? 0 : (i / (count - 1)) * 100}%` }]}
              />
            ))}
            <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none">
              <View style={styles.thumbCore} />
            </Animated.View>
          </View>
        </View>
      </GestureDetector>

      {/* Stop labels — tappable, aligned under each tick. */}
      <View style={styles.labels}>
        {stops.map((s, i) => {
          const selected = i === selectedIndex
          const align = i === 0 ? 'flex-start' : i === count - 1 ? 'flex-end' : 'center'
          return (
            <Pressable
              key={s.key}
              onPress={() => jumpTo(i)}
              style={[styles.labelCell, { alignItems: align }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${s.label}, ${s.delta > 0 ? '+' : ''}${s.delta} kcal`}
            >
              <Text style={[styles.labelText, selected && styles.labelSelected]}>{s.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  hitbox: {
    height: THUMB + 12,
    justifyContent: 'center',
    // Inset so the thumb center can reach the very edges without the
    // thumb body clipping the screen padding.
    paddingHorizontal: THUMB / 2,
  },
  track: {
    height: THUMB,
    justifyContent: 'center',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_H,
    borderRadius: TRACK_H,
    backgroundColor: colors.bruma,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: TRACK_H,
    borderRadius: TRACK_H,
    backgroundColor: colors.magenta,
  },
  tick: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: -2,
    backgroundColor: colors.leche,
    opacity: 0.5,
  },
  thumb: {
    position: 'absolute',
    left: -THUMB / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.magentaGlow,
  },
  thumbCore: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.magentaHot,
    borderWidth: 2,
    borderColor: colors.leche,
  },
  labels: {
    flexDirection: 'row',
  },
  labelCell: {
    flex: 1,
  },
  labelText: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.micro,
    color: colors.niebla,
  },
  labelSelected: {
    fontFamily: typography.uiSemi,
    color: colors.leche,
  },
})
