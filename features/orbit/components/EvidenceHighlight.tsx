import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import { barFractions, barRate, type EvidenceIcon, type EvidenceLook } from '../evidence-highlight'
import type { EvidenceBar } from '../month-built'

/*
 * "La evidencia" como un Destacado de Apple Salud (dueña 5 oct 2026): arriba
 * los íconos de las dos cosas que se cruzan (entran con un rebote) y la
 * categoría en su color; abajo la comparación, cada lado con su número grande
 * que cuenta hacia arriba y una barra gruesa que crece. El lado resaltado va
 * en el color del patrón; el otro, atenuado. Todo one-shot y con
 * reduce-motion. El título, el chip y el porqué los pinta el modal.
 */

const BAR_H = 14
const DIM = 'rgba(201, 184, 165, 0.38)'

export function EvidenceHeader({ look }: { look: EvidenceLook }) {
  return (
    <View style={styles.header}>
      <View style={styles.icons}>
        {look.icons.map((icon, i) => (
          <IconDisc key={icon.name} icon={icon} index={i} />
        ))}
      </View>
      <Text style={[styles.kicker, { color: look.accent }]}>{look.kicker.toUpperCase()}</Text>
    </View>
  )
}

function IconDisc({ icon, index }: { icon: EvidenceIcon; index: number }) {
  const reduce = useReducedMotion() ?? false
  return (
    <Animated.View
      entering={
        reduce
          ? undefined
          : ZoomIn.springify()
              .damping(11)
              .delay(150 + index * 100)
      }
      style={[styles.disc, { backgroundColor: `${icon.color}38` }, index > 0 && styles.discOverlap]}
    >
      <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
    </Animated.View>
  )
}

export function EvidenceComparison({
  bars,
  unit,
  accent,
}: {
  bars: readonly EvidenceBar[]
  unit: string
  accent: string
}) {
  const fractions = barFractions(bars)
  return (
    <View style={styles.compare}>
      {bars.map((b, i) => (
        <CompareRow
          key={`${b.label}-${i}`}
          bar={b}
          unit={unit}
          fraction={fractions[i] ?? 0}
          color={b.highlight ? accent : DIM}
          highlight={b.highlight === true}
          delay={250 + i * 180}
        />
      ))}
    </View>
  )
}

function CompareRow({
  bar,
  unit,
  fraction,
  color,
  highlight,
  delay,
}: {
  bar: EvidenceBar
  unit: string
  fraction: number
  color: string
  highlight: boolean
  delay: number
}) {
  const reduce = useReducedMotion() ?? false
  const rate = barRate(bar)
  const target = rate != null ? Math.round(rate * 100) : Math.round(bar.value)
  const shown = useCountUp(target, delay, reduce)

  const width = useSharedValue(reduce ? fraction : 0)
  useEffect(() => {
    width.value = reduce
      ? fraction
      : withDelay(delay, withTiming(fraction, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [fraction, delay, reduce, width])
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, width.value)) * 100}%`,
  }))

  return (
    <View
      accessible
      accessibilityLabel={
        rate != null
          ? `${bar.label}: ${target}%, ${bar.value} de ${bar.total} ${unit}`
          : `${bar.label}: ${target} ${unit}`
      }
    >
      <Text style={styles.rowLabel}>{bar.label}</Text>
      <Text style={[styles.num, { color: highlight ? color : colors.bone }]}>
        {shown}
        <Text style={styles.unit}>{rate != null ? '%' : ` ${unit}`}</Text>
        {rate != null ? (
          <Text style={styles.of}>{`   ${bar.value} de ${bar.total} ${unit}`}</Text>
        ) : null}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  )
}

/** El número cuenta de 0 a `to` (ease-out, ~0.9 s) después de `delay`. */
function useCountUp(to: number, delay: number, reduce: boolean): number {
  const [value, setValue] = useState(reduce ? to : 0)
  useEffect(() => {
    if (reduce) {
      setValue(to)
      return
    }
    let frame = 0
    const start = Date.now() + delay
    const tick = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - start) / 900))
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [to, delay, reduce])
  return value
}

export function EvidenceChip({ text, color }: { text: string; color: string }) {
  const reduce = useReducedMotion() ?? false
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.duration(380).delay(1100)}
      style={[styles.chip, { backgroundColor: `${color}29` }]}
    >
      <MaterialCommunityIcons name="triangle" size={9} color={color} />
      <Text style={[styles.chipText, { color }]}>{text}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icons: { flexDirection: 'row', alignItems: 'center' },
  disc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El segundo ícono se encima al primero, con un filo del color de la tarjeta.
  discOverlap: { marginLeft: -8, borderWidth: 3, borderColor: colors.bgCard2 },
  kicker: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    letterSpacing: 0.4,
  },
  compare: {
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
  },
  rowLabel: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginBottom: 2,
  },
  num: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.displayLg,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.ui,
    letterSpacing: 0,
    color: colors.niebla,
  },
  of: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0,
    color: colors.niebla,
  },
  track: {
    marginTop: 8,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: 'rgba(244, 236, 222, 0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: BAR_H / 2 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  chipText: { fontFamily: typography.uiBold, fontSize: typography.sizes.body },
})
