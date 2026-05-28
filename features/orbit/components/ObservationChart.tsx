import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { ObservationChart as ChartData } from '../mock'

/*
 * The mini-chart that ships beside each first-cycle observation —
 * dynamic evidence behind the label. Three variants:
 *
 *  · daily          — 22 vertical bars (one per logged day) with
 *                     the peak or valley day called out in magenta.
 *                     The shape of the cycle is read at a glance.
 *  · dimensionStack — 6 stacked sparklines, one per dimension,
 *                     ordered by stability. The focus dimension is
 *                     drawn magenta and visibly flatter than the
 *                     rest — used for "tu ancla". A single line
 *                     alone wouldn't carry meaning (no contrast);
 *                     stacking 6 makes "this one is the steady one"
 *                     legible without explanation.
 *  · weekday        — 7 bars (L M M J V S D) with one focus day,
 *                     used for the tentative jueves hypothesis.
 *                     Same visual shape as PatternCard's
 *                     WeekdayGlyph but at a wider scale so it can
 *                     stand on its own.
 *
 * The component is purely presentational and consumes the
 * `ObservationChart` discriminated union from mock.ts.
 */
export function ObservationChart({ chart }: { chart: ChartData }) {
  switch (chart.kind) {
    case 'daily':
      return <DailyChart data={chart} />
    case 'dimensionStack':
      return <DimensionStackChart data={chart} />
    case 'weekday':
      return <WeekdayChart data={chart} />
  }
}

/* 22-day bar chart of overall brightness. The focus day is drawn
 * magenta + slightly wider, with a small bright dot above when it's
 * a peak. Valley focus stays grounded (no dot) so the eye still
 * recognises which way the observation points. */
function DailyChart({ data }: { data: Extract<ChartData, { kind: 'daily' }> }) {
  const W = 296
  const H = 70
  const N = data.days.length
  const BAR_W = 6
  const GAP = (W - BAR_W * N) / (N - 1)
  const TOP = 8
  const BASELINE = H - 18
  const MAX_H = BASELINE - TOP
  const focusIdx = data.focusDay - 1
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.days.map((v, i) => {
        const x = i * (BAR_W + GAP)
        const h = Math.max(2, v * MAX_H)
        const isFocus = i === focusIdx
        return (
          <Rect
            key={i}
            x={x + (isFocus ? -0.5 : 0)}
            y={BASELINE - h}
            width={BAR_W + (isFocus ? 1 : 0)}
            height={h}
            rx={1.5}
            fill={isFocus ? colors.magenta : colors.bruma}
            opacity={isFocus ? 1 : 0.55}
          />
        )
      })}
      {/* Bright spark above the focus bar — only for peaks. */}
      {data.focusKind === 'peak' ? (
        <Circle
          cx={focusIdx * (BAR_W + GAP) + BAR_W / 2}
          cy={BASELINE - data.days[focusIdx]! * MAX_H - 5}
          r={2.4}
          fill="#FFFFFF"
          opacity={0.95}
        />
      ) : null}
      {/* Day label under the focus bar. */}
      <SvgText
        x={focusIdx * (BAR_W + GAP) + BAR_W / 2}
        y={H - 2}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9}
        letterSpacing={0.6}
        fill={colors.magenta}
      >
        {`día ${data.focusDay}`}
      </SvgText>
    </Svg>
  )
}

/* Six stacked sparklines, one per dimension, sorted by stability
 * (most stable on top, wildest at the bottom). The focus dimension
 * is drawn magenta; the rest in muted cream. Each row uses the
 * same y-scale (0.2–1.0) so a near-flat trace stays visually flat
 * — that's how "tu ancla" reads at a glance: mente's line barely
 * moves while ciclo's line zigzags. Labels sit on the left, the
 * sparklines fill the rest of the width. */
function DimensionStackChart({ data }: { data: Extract<ChartData, { kind: 'dimensionStack' }> }) {
  const W = 296
  const ROW_H = 18
  const N_ROWS = data.dimensions.length
  const TOP_PAD = 6
  const H = TOP_PAD + ROW_H * N_ROWS
  const LABEL_W = 60
  const SPARK_X = LABEL_W
  const SPARK_W = W - LABEL_W
  const ROW_PAD = 3 // breathing room inside each row
  const yMin = 0.2
  const yMax = 1.0
  // Sort ascending by variance — most stable first, so the focus
  // line lands at the top of the stack with the eye.
  const rows = [...data.dimensions].sort((a, b) => a.variance - b.variance)

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {rows.map((dim, rowIdx) => {
        const isFocus = dim.key === data.focusKey
        const top = TOP_PAD + rowIdx * ROW_H + ROW_PAD
        const bot = TOP_PAD + (rowIdx + 1) * ROW_H - ROW_PAD
        const mid = (top + bot) / 2
        const N = dim.days.length
        const px = (i: number) => SPARK_X + (i / (N - 1)) * SPARK_W
        const py = (v: number) => bot - ((v - yMin) / (yMax - yMin)) * (bot - top)
        const path = dim.days
          .map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)
          .join(' ')
        return (
          <G key={dim.key}>
            <SvgText
              x={4}
              y={mid + 3}
              fontFamily={isFocus ? typography.uiBold : typography.uiMedium}
              fontSize={9.5}
              letterSpacing={0.5}
              fill={isFocus ? colors.magenta : colors.niebla}
              opacity={isFocus ? 1 : 0.7}
            >
              {dim.label}
            </SvgText>
            {/* Faint row baseline — quietly marks the row's middle so
                a flat line still has a reference. */}
            <Line
              x1={SPARK_X}
              y1={mid}
              x2={W}
              y2={mid}
              stroke={colors.bruma}
              strokeOpacity={0.18}
              strokeWidth={0.4}
            />
            <Path
              d={path}
              fill="none"
              stroke={isFocus ? colors.magenta : colors.bruma}
              strokeWidth={isFocus ? 1.5 : 0.9}
              strokeOpacity={isFocus ? 1 : 0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        )
      })}
    </Svg>
  )
}

/* Seven bars (L M M J V S D) with one focus day called out in
 * magenta. Used for the tentative weekday hypothesis — same visual
 * language as PatternCard's WeekdayGlyph so the user reads cycle-1
 * observations and mature-cycle patterns as "the same family of
 * shape, different confidence". */
function WeekdayChart({ data }: { data: Extract<ChartData, { kind: 'weekday' }> }) {
  const W = 296
  const H = 70
  const N = 7
  const BAR_W = 22
  const GAP = (W - BAR_W * N) / (N - 1)
  const TOP = 10
  const BASELINE = H - 18
  const MAX_H = BASELINE - TOP
  const WEEK_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.bars.map((v, i) => {
        const x = i * (BAR_W + GAP)
        const h = Math.max(3, v * MAX_H)
        const isFocus = i === data.focus
        return (
          <Rect
            key={`bar-${i}`}
            x={x}
            y={BASELINE - h}
            width={BAR_W}
            height={h}
            rx={2}
            fill={isFocus ? colors.magenta : colors.bruma}
            opacity={isFocus ? 1 : 0.6}
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
            y={H - 3}
            textAnchor="middle"
            fontFamily={typography.uiBold}
            fontSize={9.5}
            letterSpacing={0.6}
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
