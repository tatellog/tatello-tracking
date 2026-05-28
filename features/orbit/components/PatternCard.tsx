import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg'

import { EmText } from '@/components/EmText'
import { colors, typography } from '@/theme'

import type { CycleData, PairedData, Patron, PatronCategory, WeekdayData } from '../mock'

const CATEGORY_TAG: Record<PatronCategory, string> = {
  recurrencia: 'se repite',
  comparacion: 'destaca',
  correlacion: 'se conecta',
}

const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/* The weekday glyph — seven small bars under their day letter, with
 * the pattern's focus day in magenta. You see at once which day the
 * pattern is about, and the shape of the week around it. */
function WeekdayGlyph({ data }: { data: WeekdayData }) {
  const W = 140
  const H = 46
  const BAR_W = 12
  const GAP = (W - BAR_W * 7) / 6
  const MAX_BAR = 26
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.week.map((v, i) => {
        const x = i * (BAR_W + GAP)
        const h = Math.max(3, v * MAX_BAR)
        const isFocus = i === data.focus
        return (
          <Rect
            key={`bar-${i}`}
            x={x}
            y={MAX_BAR - h + 2}
            width={BAR_W}
            height={h}
            rx={2}
            fill={isFocus ? colors.magenta : colors.bruma}
            opacity={isFocus ? 1 : 0.7}
          />
        )
      })}
      {WEEK_LABELS.map((lbl, i) => {
        const x = i * (BAR_W + GAP) + BAR_W / 2
        const isFocus = i === data.focus
        return (
          <SvgText
            key={`lbl-${i}`}
            x={x}
            y={H - 2}
            textAnchor="middle"
            fontFamily={typography.uiBold}
            fontSize={9.5}
            fill={isFocus ? colors.magenta : colors.niebla}
            opacity={isFocus ? 1 : 0.7}
          >
            {lbl}
          </SvgText>
        )
      })}
    </Svg>
  )
}

/* The cycle glyph — 28 small dots in a row; the lútea band lights up
 * magenta and the marked day wears a thin ring. The cycle reads as a
 * single arc you can scan. */
function CycleGlyph({ data }: { data: CycleData }) {
  const W = 144
  const H = 30
  const R = 2.4
  const span = W - 4
  const step = span / (data.length - 1)
  const [bandStart, bandEnd] = data.band
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.bars.map((_, i) => {
        const day = i + 1
        const inBand = day >= bandStart && day <= bandEnd
        const isMark = day === data.markDay
        const cx = 2 + i * step
        const cy = H / 2
        return (
          <Circle
            key={`d-${i}`}
            cx={cx}
            cy={cy}
            r={isMark ? R + 1.2 : R}
            fill={inBand ? colors.magenta : colors.bruma}
            opacity={inBand ? (isMark ? 1 : 0.85) : 0.55}
          />
        )
      })}
      {(() => {
        const cx = 2 + (data.markDay - 1) * step
        return (
          <>
            <Circle
              key="mark-ring"
              cx={cx}
              cy={H / 2}
              r={R + 4}
              fill="none"
              stroke={colors.magenta}
              strokeWidth={1}
              opacity={0.8}
            />
            <SvgText
              key="mark-day"
              x={cx}
              y={H - 2}
              textAnchor="middle"
              fontFamily={typography.uiBold}
              fontSize={9}
              fill={colors.magenta}
            >
              {data.markDay}
            </SvgText>
          </>
        )
      })()}
    </Svg>
  )
}

/* The paired glyph — two bars side by side comparing the average for
 * each group. The taller bar (or the one the pattern is about) burns
 * magenta; the other stays quiet. */
function PairedGlyph({ data }: { data: PairedData }) {
  const W = 140
  const H = 50
  const BAR_W = 30
  const GAP = 18
  const TOTAL = BAR_W * data.groups.length + GAP * (data.groups.length - 1)
  const startX = (W - TOTAL) / 2
  const MAX_BAR = 30
  const maxAvg = Math.max(...data.groups.map((g) => g.avg))
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.groups.map((g, i) => {
        const x = startX + i * (BAR_W + GAP)
        const h = (g.avg / maxAvg) * MAX_BAR
        const highlight = i === 0
        return (
          <Rect
            key={`bar-${i}`}
            x={x}
            y={MAX_BAR - h + 2}
            width={BAR_W}
            height={h}
            rx={3}
            fill={highlight ? colors.magenta : colors.bruma}
            opacity={highlight ? 1 : 0.75}
          />
        )
      })}
      {data.groups.map((g, i) => {
        const x = startX + i * (BAR_W + GAP) + BAR_W / 2
        const highlight = i === 0
        return (
          <SvgText
            key={`lbl-${i}`}
            x={x}
            y={H - 2}
            textAnchor="middle"
            fontFamily={typography.uiBold}
            fontSize={9}
            fill={highlight ? colors.magenta : colors.niebla}
          >
            {g.label}
          </SvgText>
        )
      })}
    </Svg>
  )
}

/* Picks the glyph for a pattern's data shape. */
function PatternGlyph({ patron }: { patron: Patron }) {
  switch (patron.data.kind) {
    case 'weekday':
      return <WeekdayGlyph data={patron.data} />
    case 'cycle':
      return <CycleGlyph data={patron.data} />
    case 'paired':
      return <PairedGlyph data={patron.data} />
  }
}

/*
 * One detected pattern. Two columns: the mini-glyph on the left,
 * lowercase serif-italic tag underneath ("se repite", "destaca", "se
 * conecta"); the human reading and the one-sentence detail on the
 * right. Tap opens the detail screen.
 */
export function PatternCard({ patron }: { patron: Patron }) {
  const router = useRouter()
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/orbit/pattern/${patron.id}`)}
      accessibilityRole="button"
      accessibilityLabel={patron.title}
    >
      <View style={styles.left}>
        <View style={styles.glyphBox}>
          <PatternGlyph patron={patron} />
        </View>
        <Text style={styles.tag}>{CATEGORY_TAG[patron.category]}</Text>
      </View>
      <View style={styles.right}>
        <EmText
          text={patron.title}
          emphasis={patron.emphasis}
          style={styles.title}
          emStyle={styles.em}
        />
        <Text style={styles.detail}>{patron.detail}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.bruma,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginTop: 12,
    gap: 18,
  },
  // Left column — the glyph, with the soft category tag underneath.
  left: {
    width: 140,
    alignItems: 'flex-start',
  },
  glyphBox: {
    marginBottom: 8,
  },
  // The soft tag — lowercase serif italic, niebla. Stelar's quiet
  // type word for this pattern; never academic.
  tag: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 12.5,
    color: colors.niebla,
  },
  // Right column — the human reading.
  right: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: typography.displaySemi,
    fontSize: 21,
    lineHeight: 25,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  em: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.segmentTitle,
    color: colors.magenta,
  },
  detail: {
    marginTop: 10,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    lineHeight: 18,
    color: colors.niebla,
  },
})
