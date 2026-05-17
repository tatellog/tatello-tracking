import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

const ITEM_H = 62
const VISIBLE = 5
const WHEEL_H = ITEM_H * VISIBLE
const PAD = (WHEEL_H - ITEM_H) / 2

// Whole-kg range covers every realistic body weight.
const WHOLE_MIN = 30
const WHOLE_MAX = 200
const WHOLE_VALUES = Array.from({ length: WHOLE_MAX - WHOLE_MIN + 1 }, (_, i) => WHOLE_MIN + i)
const TENTH_VALUES = Array.from({ length: 10 }, (_, i) => i)

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/* One row of a wheel — its size and opacity ease with distance from
 * the centred slot, so the selected value blazes and the rest recede. */
function WheelItem({
  label,
  index,
  scrollY,
}: {
  label: string
  index: number
  scrollY: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(index - scrollY.value / ITEM_H)
    return {
      opacity: interpolate(d, [0, 1, 2.2], [1, 0.3, 0.12], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1, 2.2], [1, 0.52, 0.34], Extrapolation.CLAMP) }],
    }
  })
  return (
    <Animated.View style={[styles.item, style]}>
      <Text style={styles.itemText}>{label}</Text>
    </Animated.View>
  )
}

/* A snapping scroll wheel. The selected index is the slot under the
 * centre line once momentum settles. */
function Wheel({
  values,
  initialIndex,
  width,
  onSettle,
}: {
  values: number[]
  initialIndex: number
  width: number
  onSettle: (index: number) => void
}) {
  const scrollY = useSharedValue(initialIndex * ITEM_H)
  const handler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })

  return (
    <Animated.ScrollView
      style={{ width, height: WHEEL_H }}
      contentContainerStyle={{ paddingVertical: PAD }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onScroll={handler}
      scrollEventThrottle={16}
      contentOffset={{ x: 0, y: initialIndex * ITEM_H }}
      onMomentumScrollEnd={(e) => {
        const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), 0, values.length - 1)
        onSettle(i)
      }}
    >
      {values.map((v, i) => (
        <WheelItem key={v} label={String(v)} index={i} scrollY={scrollY} />
      ))}
    </Animated.ScrollView>
  )
}

type Props = {
  /** Current weight in kg, one decimal. */
  value: number
  onChange: (kg: number) => void
}

/*
 * A two-wheel weight picker — the whole kilos on the left, the tenth
 * on the right, "kg" pinned beside them. The centred row of each wheel
 * is the live value; scrolling either reports the recomposed weight.
 */
export function WeightWheel({ value, onChange }: Props) {
  const whole = clamp(Math.floor(value), WHOLE_MIN, WHOLE_MAX)
  const tenth = clamp(Math.round((value - Math.floor(value)) * 10), 0, 9)

  return (
    <View style={styles.row}>
      <Wheel
        values={WHOLE_VALUES}
        initialIndex={whole - WHOLE_MIN}
        width={132}
        onSettle={(i) => onChange((WHOLE_VALUES[i] ?? whole) + tenth / 10)}
      />
      <Text style={styles.dot}>.</Text>
      <Wheel
        values={TENTH_VALUES}
        initialIndex={tenth}
        width={70}
        onSettle={(i) => onChange(whole + i / 10)}
      />
      <Text style={styles.kg}>kg</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: typography.displayHeavy,
    fontSize: 54,
    color: colors.leche,
    letterSpacing: -2,
  },
  dot: {
    fontFamily: typography.displayHeavy,
    fontSize: 54,
    color: colors.leche,
    marginHorizontal: 2,
    marginTop: -10,
  },
  kg: {
    fontFamily: typography.uiBold,
    fontSize: 18,
    color: colors.niebla,
    marginLeft: 10,
  },
})
