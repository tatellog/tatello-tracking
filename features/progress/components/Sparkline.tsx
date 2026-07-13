import Svg, { Polyline } from 'react-native-svg'

/*
 * Mini-sparkline compartida (HistoryChips, CompositionCards): la FORMA del arco,
 * sin ejes ni juicio. El hue es identidad de la métrica (mismo color suba o
 * baje); la dirección la dicen los deltas tipográficos, nunca verde/rojo.
 */
export function Sparkline({
  data,
  hue,
  width = 64,
  height = 18,
}: {
  data: number[]
  hue: string
  width?: number
  height?: number
}) {
  if (data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const points = data
    .map((v, i) => {
      const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2
      const y = height - 2 - ((v - min) / span) * (height - 4)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <Svg width={width} height={height} style={{ marginTop: 8 }}>
      <Polyline
        points={points}
        fill="none"
        stroke={hue}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </Svg>
  )
}
