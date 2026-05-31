import { useEffect, useMemo, useRef } from 'react'
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  /** Inclusive lower bound. */
  min: number
  /** Inclusive upper bound. */
  max: number
  /** Granularity. e.g. 0.1 for weight, 1 for days. */
  step: number
  /** Currently selected value. Clamped + snapped to step on mount. */
  value: number
  onChange: (next: number) => void
  /** Number of decimals to render. */
  decimals?: number
  /** Optional uppercase unit shown beside the centred number. */
  unit?: string
  /**
   * Fires `true` when the user starts spinning the wheel and `false`
   * when it comes to rest (covers both momentum and no-momentum drags).
   * Lets the host screen run a precision-dim of its atmosphere while the
   * wheel is in motion. Default no-op so existing consumers are unaffected.
   */
  onDragChange?: (dragging: boolean) => void
  /**
   * Strength of the centred value's cream halo.
   *   'default' — the standard 14 px textShadowRadius (unchanged).
   *   'soft'    — a quieter 11 px halo, used ONLY by the weight step so
   *               the number never becomes a celebrated focal point.
   */
  valueGlow?: 'soft' | 'default'
}

const ITEM_HEIGHT = 56
const VISIBLE_COUNT = 5 // odd so there's always one centred line

/*
 * A vertical scroll-wheel value picker. The user spins through the
 * range; the centred row is the picked value. Built with FlatList +
 * snapToInterval so there's no extra dependency — the visual is the
 * classic iOS-style picker (centre highlighted, neighbours faded).
 *
 * Used for the weight step (decimal, wide range — a stepper would
 * mean dozens of taps). For discrete short ranges (cycle length 21–
 * 45, sleep 3–14) the existing Stepper is still simpler and lands
 * the user on the right value faster.
 */
export function WheelPicker({
  min,
  max,
  step,
  value,
  onChange,
  decimals = 0,
  unit,
  onDragChange,
  valueGlow = 'default',
}: Props) {
  const listRef = useRef<FlatList<number>>(null)

  // Build the value range once. Number-safe arithmetic (round to
  // 10^decimals so floating-point doesn't drift over many steps).
  const values = useMemo<number[]>(() => {
    const out: number[] = []
    const scale = Math.pow(10, decimals)
    const start = Math.round(min * scale)
    const end = Math.round(max * scale)
    const inc = Math.round(step * scale)
    for (let v = start; v <= end; v += inc) {
      out.push(v / scale)
    }
    return out
  }, [min, max, step, decimals])

  // Snap the incoming value to the nearest item index.
  const initialIndex = useMemo(() => {
    let best = 0
    let bestDelta = Infinity
    for (let i = 0; i < values.length; i++) {
      const delta = Math.abs(values[i]! - value)
      if (delta < bestDelta) {
        best = i
        bestDelta = delta
      }
    }
    return best
  }, [values, value])

  // Scroll the list to the initial item once the layout has settled.
  // scrollToIndex needs the FlatList to be measured; a microtask
  // delay is enough on iOS.
  useEffect(() => {
    const id = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false })
    }, 50)
    return () => clearTimeout(id)
    // We deliberately only fire this once on mount — letting the user
    // scroll freely afterwards without our useEffect snapping back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(values.length - 1, idx))
    const next = values[clamped]
    if (next != null && next !== value) onChange(next)
    // Settled by momentum — the wheel has come to rest.
    onDragChange?.(false)
  }

  const padding = ((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT
  const totalHeight = VISIBLE_COUNT * ITEM_HEIGHT

  return (
    <View style={[styles.wrap, { height: totalHeight }]}>
      {/* Centre highlight band — magenta hairlines top & bottom mark
          the slot whose value is currently picked. Carries a static
          resting halo (magentaHot, soft radius) so the picked slot
          reads as gently "lit" — the same ignition vocabulary as the
          sex-pill / hairline glows on the twin screens. The halo is
          STATIC (never animated, never brighter on a heavier number),
          so it never celebrates the value. */}
      <View
        pointerEvents="none"
        style={[styles.centreBand, { top: padding, height: ITEM_HEIGHT }]}
      />

      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(v) => String(v)}
        getItemLayout={(_data, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onScrollBeginDrag={() => onDragChange?.(true)}
        onScrollEndDrag={() => onDragChange?.(false)}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{ paddingVertical: padding }}
        renderItem={({ item }) => {
          const isSelected = item === value
          return (
            <View style={styles.row}>
              <View style={styles.valueGroup}>
                <Text
                  style={[
                    styles.value,
                    isSelected
                      ? valueGlow === 'soft'
                        ? styles.valueActiveSoft
                        : styles.valueActive
                      : styles.valueIdle,
                  ]}
                >
                  {item.toFixed(decimals)}
                </Text>
                {isSelected && unit ? <Text style={styles.unit}>{unit}</Text> : null}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    position: 'relative',
  },
  centreBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.magenta,
    opacity: 0.4,
    // Static resting halo — the picked slot is gently lit, echoing the
    // "se enciende" of the twin screens. Not animated; iOS-only blur
    // (Android degrades to a harmless flat rect — iOS is the validation
    // platform).
    shadowColor: colors.magentaHot,
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  row: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Group keeps the value + unit visually attached (e.g. "69.8 kg")
  // so the kg sits inline with the digits instead of floating to the
  // wheel's far-right edge.
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 40,
    letterSpacing: -1,
    includeFontPadding: false,
  },
  // The selected row gets a soft cream halo against the dark cosmic
  // backdrop — same vocabulary as the 58 px hero on body-base.
  valueActive: {
    color: colors.leche,
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  // Quieter halo for the weight step (valueGlow="soft") — the number
  // must stay still and un-celebrated. Same colour, smaller radius.
  valueActiveSoft: {
    color: colors.leche,
    textShadowColor: 'rgba(252, 246, 235, 0.22)',
    textShadowRadius: 11,
    textShadowOffset: { width: 0, height: 0 },
  },
  valueIdle: {
    color: colors.bruma,
  },
  unit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.magenta,
    letterSpacing: -0.3,
  },
})
