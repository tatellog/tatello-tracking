import { useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { DayCard, DayCardWeight, DayMetric } from '../day-readings'
import { LiveDot } from './LiveDot'

const STAR_GOLD = '#FFE9C2'
const STAR_PINK = '#FBD7E3'

/*
 * "Cómo va tu día" — today's live readings, elevated to a small night sky.
 * The deficit (Comida) is the luminous hero; the rest are the field of
 * stars around it. Bars are orbital traces with a light-point head; the
 * over-deficit overflow warms to GOLD (never red). Numbers stay leche
 * facts; judgment colour lives only in the bar.
 */
export function DayLiveReadings({ cards }: { cards: readonly DayCard[] }) {
  if (cards.length === 0) return null
  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <View style={styles.eyebrowRow}>
        <LiveDot />
        <Text style={styles.eyebrow}>Cómo va tu día</Text>
      </View>
      {cards.map((c, i) => (
        <LiveCard key={c.key} card={c} index={i} />
      ))}
    </Animated.View>
  )
}

/* ── A card — chassis weighted hero/mid/soft, with a cosmic backdrop ── */
function LiveCard({ card, index }: { card: DayCard; index: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const onLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout
    setSize((p) => (p && p.w === width && p.h === height ? p : { w: width, h: height }))
  }
  const overTone = card.status?.tone === 'over'
  const isSoft = card.weight === 'soft'

  return (
    <Animated.View
      entering={FadeIn.duration(300).delay(60 * index)}
      style={[styles.card, isSoft ? styles.cardSoft : styles.cardRich]}
      onLayout={onLayout}
    >
      {!isSoft && size ? (
        <CardBackdrop weight={card.weight} over={overTone} width={size.w} height={size.h} />
      ) : null}

      <View style={styles.cardHead}>
        <Text style={styles.cardLabel}>{card.label}</Text>
        {card.status ? (
          <StatusChip text={card.status.text} over={card.status.tone === 'over'} />
        ) : null}
      </View>

      {card.metrics.map((m) => (
        <MetricRow key={m.key} metric={m} />
      ))}

      {card.coach ? (
        <View style={styles.coachRow}>
          <View style={[styles.coachBar, overTone && styles.coachBarOver]} />
          <Text style={styles.coach}>{card.coach}</Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

/* ── Cosmic backdrop: a top-left sky wash, a gradient aura border, and
 *    (hero only) a micro-constellation watermark. One SVG, cheap. ──── */
function CardBackdrop({
  weight,
  over,
  width,
  height,
}: {
  weight: DayCardWeight
  over: boolean
  width: number
  height: number
}) {
  const r = 22
  const auraA = over ? colors.oro : colors.oro
  const auraB = over ? colors.oro : colors.magenta
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="card-wash" cx="14%" cy="6%" r="80%">
          <Stop offset="0%" stopColor="#1F0E13" stopOpacity={weight === 'hero' ? 0.55 : 0.38} />
          <Stop offset="100%" stopColor="#1F0E13" stopOpacity={0} />
        </RadialGradient>
        <SvgLinearGradient id="card-aura" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={auraA} stopOpacity={over ? 0.34 : 0.28} />
          <Stop offset="48%" stopColor={colors.leche} stopOpacity={0.05} />
          <Stop offset="100%" stopColor={auraB} stopOpacity={over ? 0.34 : 0.26} />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} rx={r} fill="url(#card-wash)" />
      <Rect
        x={0.75}
        y={0.75}
        width={width - 1.5}
        height={height - 1.5}
        rx={r - 0.75}
        fill="none"
        stroke="url(#card-aura)"
        strokeWidth={1}
      />
      {weight === 'hero' ? (
        <>
          {/* micro-constellation — the mark of belonging to Órbita. */}
          <Line
            x1={width - 22}
            y1={15}
            x2={width - 46}
            y2={25}
            stroke={colors.oro}
            strokeWidth={0.6}
            strokeOpacity={0.3}
          />
          <Circle cx={width - 22} cy={15} r={1.4} fill={colors.oro} opacity={0.55} />
          <Circle cx={width - 46} cy={25} r={1.1} fill={colors.oro} opacity={0.42} />
          <Circle cx={width - 33} cy={40} r={0.9} fill={colors.oro} opacity={0.34} />
        </>
      ) : null}
    </Svg>
  )
}

/* ── A small light-point at the head of a progress trace ───────────── */
function StarTip({ gold }: { gold: boolean }) {
  const id = gold ? 'tip-gold' : 'tip-pink'
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
          <Stop offset="36%" stopColor={gold ? STAR_GOLD : STAR_PINK} stopOpacity={0.7} />
          <Stop offset="100%" stopColor={gold ? colors.oro : colors.magenta} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={7} cy={7} r={7} fill={`url(#${id})`} />
      <Circle cx={7} cy={7} r={1.6} fill="#FFFFFF" />
    </Svg>
  )
}

/* ── Orbital progress bar: gradient fill + glow + star-head, with the
 *    over-deficit overflow warming to gold ───────────────────────────── */
function OrbitalBar({ metric: m }: { metric: DayMetric }) {
  const fill = Math.min(1, Math.max(0, m.fill ?? 0))
  const isMagenta = m.key === 'protein' || m.key === 'water'
  const over = m.tone === 'over'
  const fillColors: [string, string] = over
    ? ['rgba(244,236,222,0.5)', 'rgba(244,236,222,0.5)']
    : isMagenta
      ? [colors.magenta, colors.magentaHot]
      : [colors.niebla, colors.niebla]
  // Visual width of the gold overflow segment (capped so it never dominates).
  const goldW = over ? Math.min(0.4, Math.max(0.12, m.over ?? 0.12)) : 0

  return (
    <View style={styles.barRow}>
      <View style={styles.track}>
        <LinearGradient
          colors={fillColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${fill * 100}%` }, isMagenta && styles.fillGlow]}
        />
        {over ? (
          <LinearGradient
            colors={['rgba(244,236,222,0.4)', colors.oroSoft, colors.oro]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.overFill, { width: `${goldW * 100}%` }]}
          />
        ) : null}
      </View>
      {/* star-head at the progress tip */}
      <View style={[styles.tip, { left: `${fill * 100}%` }]} pointerEvents="none">
        <StarTip gold={over} />
      </View>
    </View>
  )
}

function StatusChip({ text, over }: { text: string; over: boolean }) {
  return (
    <View
      style={[styles.chip, styles.statusChip, over ? styles.statusChipOver : styles.statusChipIn]}
    >
      <View style={styles.statusHalo}>
        <View style={[styles.statusDot, { backgroundColor: over ? colors.oro : colors.magenta }]} />
      </View>
      <Text style={[styles.statusText, { color: over ? colors.oroSoft : colors.magenta }]}>
        {text}
      </Text>
    </View>
  )
}

function MetricRow({ metric: m }: { metric: DayMetric }) {
  if (m.display === 'chip') {
    const win = m.tone === 'win'
    const isCycle = m.key === 'cycle'
    const dotColor = isCycle ? colors.dimension.ciclo : colors.magenta
    return (
      <View style={styles.row}>
        <Text style={styles.metricLabel}>{m.label}</Text>
        <View style={styles.rowRight}>
          <View style={[styles.chip, win && styles.chipWin]}>
            <View style={styles.statusHalo}>
              <View
                style={[styles.statusDot, { backgroundColor: win ? dotColor : colors.niebla }]}
              />
            </View>
            <Text style={[styles.chipText, win && styles.chipTextWin]}>{m.value}</Text>
          </View>
        </View>
      </View>
    )
  }

  if (m.display === 'dots') {
    const filled = m.dots ?? 0
    return (
      <View style={styles.row}>
        <Text style={styles.metricLabel}>{m.label}</Text>
        <View style={styles.rowRight}>
          <View style={styles.dots}>
            {Array.from({ length: 5 }).map((_, i) =>
              i < filled ? (
                <View key={i} style={styles.dotOn} />
              ) : (
                <View key={i} style={styles.dotOff} />
              ),
            )}
          </View>
        </View>
      </View>
    )
  }

  // 'plain' and 'bar'
  return (
    <View style={styles.row}>
      <Text style={styles.metricLabel}>{m.label}</Text>
      {m.display === 'bar' ? <OrbitalBar metric={m} /> : <View style={styles.plainSpacer} />}
      <View style={styles.valueCol}>
        <Text style={styles.value}>{m.value}</Text>
        {m.sub ? <Text style={styles.sub}>{m.sub}</Text> : null}
      </View>
    </View>
  )
}

const STAR = 14

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    marginLeft: 2,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  card: {
    borderRadius: 22,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cardRich: {
    backgroundColor: 'rgba(20,10,14,0.45)',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  cardSoft: {
    backgroundColor: 'rgba(244,236,222,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(244,236,222,0.06)',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.niebla,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metricLabel: {
    width: 74,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  rowRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  // ── orbital bar ──
  barRow: {
    flex: 1,
    height: STAR,
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(244,236,222,0.07)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  fillGlow: {
    shadowColor: colors.magenta,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  overFill: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  tip: {
    position: 'absolute',
    top: (STAR - STAR) / 2,
    width: STAR,
    height: STAR,
    marginLeft: -STAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainSpacer: {
    flex: 1,
  },
  valueCol: {
    minWidth: 72,
    alignItems: 'flex-end',
  },
  value: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.2,
    color: colors.leche,
  },
  sub: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    marginTop: 1,
  },
  // ── chips (status + entreno/ciclo) ──
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  chipWin: {
    borderColor: 'rgba(233,30,99,0.4)',
  },
  chipText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.label,
    color: colors.bone,
  },
  chipTextWin: {
    color: colors.leche,
  },
  statusChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusChipIn: {
    backgroundColor: 'rgba(233,30,99,0.10)',
    borderColor: 'rgba(233,30,99,0.35)',
  },
  statusChipOver: {
    backgroundColor: 'rgba(217,174,111,0.10)',
    borderColor: 'rgba(217,174,111,0.4)',
  },
  statusHalo: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // ── energy dots (stars on/off) ──
  dots: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dotOn: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.leche,
    shadowColor: colors.leche,
    shadowOpacity: 0.7,
    shadowRadius: 2.5,
    shadowOffset: { width: 0, height: 0 },
  },
  dotOff: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(244,236,222,0.12)',
  },
  // ── coach voice — an illuminated quote ──
  coachRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  coachBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(233,30,99,0.45)',
    marginRight: 10,
  },
  coachBarOver: {
    backgroundColor: 'rgba(217,174,111,0.5)',
  },
  coach: {
    flex: 1,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
})
